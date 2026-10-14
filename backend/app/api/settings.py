from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator

from app.core.config import DEFAULT_ANALYSIS_MODEL, get_settings, read_analysis_settings, save_analysis_settings
from app.errors import ApiError
from app.schemas.errors import ErrorResponse


class AnalysisSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    model: str = Field(default=DEFAULT_ANALYSIS_MODEL, min_length=1, max_length=200,
                       pattern=r'^[A-Za-z0-9~][A-Za-z0-9._:/~-]*$')
    api_key: SecretStr = SecretStr('')

    @field_validator('api_key')
    @classmethod
    def validate_key(cls, value: SecretStr) -> SecretStr:
        key = value.get_secret_value()
        if len(key) > 512 or any(ord(char) < 32 or ord(char) > 126 for char in key):
            raise ValueError('Invalid API key.')
        key = key.strip()
        if ' ' in key:
            raise ValueError('Invalid API key.')
        return SecretStr(key)


class AnalysisSettingsStatus(BaseModel):
    model: str
    api_key_configured: bool
    restart_required: bool


def require_local_request(request: Request) -> None:
    local_hosts = {'127.0.0.1', 'localhost', '::1'}
    origin = request.headers.get('origin')
    allowed_origins = {*get_settings().frontend_origins, str(request.base_url).rstrip('/')}
    if (request.client is None or request.client.host not in local_hosts
            or request.url.hostname not in local_hosts
            or (origin is None and request.headers.get('sec-fetch-site') == 'cross-site')
            or (origin is not None and (origin not in allowed_origins
                                        or urlsplit(origin).hostname not in local_hosts))):
        raise ApiError(status_code=403, code='local_settings_only',
                       message='Analysis settings are only available locally.', retryable=False)
    if request.method == 'PUT' and request.headers.get('content-type', '').split(';')[0].strip() != 'application/json':
        raise ApiError(status_code=415, code='invalid_request',
                       message='Use a JSON request body.', retryable=False)


router = APIRouter(tags=['settings'], dependencies=[Depends(require_local_request)], responses={
    status: {'model': ErrorResponse} for status in (403, 415, 422, 503)
})


def configuration_status(request: Request, model: str, api_key: str) -> AnalysisSettingsStatus:
    return AnalysisSettingsStatus(
        model=model, api_key_configured=bool(api_key),
        restart_required=(model != request.app.state.analysis_model
                          or api_key != (request.app.state.analysis_client.api_key or '')),
    )


@router.get('/settings/analysis', response_model=AnalysisSettingsStatus)
def get_analysis_settings(request: Request):
    return configuration_status(request, *read_analysis_settings())


@router.put('/settings/analysis', response_model=AnalysisSettingsStatus)
def update_analysis_settings(body: AnalysisSettingsUpdate, request: Request):
    return configuration_status(request, *save_analysis_settings(body.model, body.api_key.get_secret_value()))
