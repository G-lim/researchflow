from dataclasses import dataclass
from functools import lru_cache
import os
from pathlib import Path
from tempfile import NamedTemporaryFile
from threading import Lock

from dotenv import dotenv_values, set_key

from app.errors import ApiError

BACKEND_DIRECTORY = Path(__file__).resolve().parents[2]
ANALYSIS_ENV_FILE = BACKEND_DIRECTORY / '.env'
DEFAULT_ANALYSIS_MODEL = 'anthropic/claude-haiku-5.5'
_analysis_settings_lock = Lock()


def read_analysis_settings() -> tuple[str, str]:
    try:
        with ANALYSIS_ENV_FILE.open(encoding='utf-8') as stream:
            values = dotenv_values(stream=stream, interpolate=False)
    except FileNotFoundError:
        values = {}
    except (OSError, UnicodeError):
        raise ApiError(status_code=503, code='analysis_settings_unavailable',
                       message='Local analysis settings could not be read.', retryable=True) from None
    model = (values.get('OPENROUTER_MODEL', os.getenv('OPENROUTER_MODEL')) or '').strip()
    key = (values.get('OPENROUTER_API_KEY', os.getenv('OPENROUTER_API_KEY')) or '').strip()
    return model or DEFAULT_ANALYSIS_MODEL, key


def save_analysis_settings(model: str, api_key: str) -> tuple[str, str]:
    with _analysis_settings_lock:
        temporary_path = None
        try:
            _, existing_key = read_analysis_settings()
            api_key = api_key or existing_key
            original = ANALYSIS_ENV_FILE.read_text(encoding='utf-8') if ANALYSIS_ENV_FILE.exists() else ''
            with NamedTemporaryFile(mode='w', encoding='utf-8', dir=ANALYSIS_ENV_FILE.parent,
                                    prefix='.env.', delete=False) as temporary:
                temporary_path = Path(temporary.name)
                temporary.write(original)
            set_key(temporary_path, 'OPENROUTER_MODEL', model)
            set_key(temporary_path, 'OPENROUTER_API_KEY', api_key)
            temporary_path.chmod(0o600)
            os.replace(temporary_path, ANALYSIS_ENV_FILE)
        except (OSError, UnicodeError):
            raise ApiError(status_code=503, code='analysis_settings_unavailable',
                           message='Local analysis settings could not be saved.', retryable=True) from None
        finally:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)
        return model, api_key


@dataclass(frozen=True)
class Settings:
    frontend_origins: tuple[str, ...]
    openalex_api_key: str | None
    openalex_base_url: str
    database_path: Path
    pdf_cache_path: Path
    openrouter_api_key: str | None = None
    openrouter_model: str | None = None


@lru_cache
def get_settings() -> Settings:
    analysis_model, analysis_key = read_analysis_settings()
    origins_value = os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )
    origins = tuple(
        dict.fromkeys(
            origin.strip() for origin in origins_value.split(",") if origin.strip()
        )
    )

    return Settings(
        frontend_origins=origins,
        openalex_api_key=os.getenv("OPENALEX_API_KEY") or None,
        openalex_base_url=os.getenv(
            "OPENALEX_BASE_URL",
            "https://api.openalex.org",
        ),
        database_path=BACKEND_DIRECTORY / Path(
            os.getenv("DATABASE_PATH") or "data/researchflow.sqlite3"
        ),
        pdf_cache_path=BACKEND_DIRECTORY / Path(
            os.getenv("PDF_CACHE_PATH") or "data/pdfs"
        ),
        openrouter_api_key=analysis_key or None,
        openrouter_model=analysis_model,
    )
