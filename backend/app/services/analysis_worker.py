import asyncio
from contextlib import suppress
import logging

from app.errors import ApiError
from app.services.analyses import AnalysisStore
from app.services.analysis_client import AnalysisClient
from app.services.analysis_evidence import make_batches, validate_candidates


async def database_call(function, *args):
    # SQLite threads cannot be cancelled. Wait for the transaction before releasing the worker lock.
    task = asyncio.create_task(asyncio.to_thread(function, *args))
    try:
        return await asyncio.shield(task)
    except asyncio.CancelledError:
        with suppress(Exception):
            await task
        raise


class AnalysisRunner:
    def __init__(self, store: AnalysisStore, get_client):
        # get_client 是一个无参回调，每次返回当前的 AnalysisClient
        # 这样 PUT /api/settings/analysis 更新 app.state 后能立即生效
        self.store = store
        self._get_client = get_client

    async def run(self):
        needs_recovery = False
        try:
            while True:
                try:
                    if needs_recovery:
                        await database_call(self.store.recover_interrupted)
                        needs_recovery = False
                    run_id = await database_call(self.store.claim_next)
                    if run_id is None:
                        await asyncio.sleep(0.5)
                    else:
                        await self.execute(run_id)
                except Exception:
                    logging.getLogger(__name__).warning('Analysis worker could not finish an operation.')
                    needs_recovery = True
                    await asyncio.sleep(1)
        finally:
            await database_call(self.store.recover_interrupted)

    async def execute(self, run_id: int):
        try:
            run, chunks, settings = await database_call(self.store.input, run_id)
            if run.status != 'processing':
                return
            # 每次 execute 拿一次 client，让本次 run 用一致的配置；
            # 下一次 run 会拿到最新的 client
            client = self._get_client()
            async with asyncio.timeout(settings['run_timeout']):
                findings, candidate_count = [], 0
                for batch in make_batches(chunks, settings):
                    candidates = await client.analyse(batch, run.service_model, settings)
                    candidate_count += len(candidates)
                    findings.extend(validate_candidates(candidates, batch, run.document_id))
                await database_call(self.store.complete, run_id, findings, candidate_count)
        except asyncio.CancelledError:
            await database_call(self.store.fail, run_id, 'analysis_interrupted', 'Analysis stopped. Retry the analysis.')
            raise
        except TimeoutError:
            await database_call(self.store.fail, run_id, 'analysis_timeout', 'The analysis exceeded its time limit.')
        except ApiError as exc:
            await database_call(self.store.fail, run_id, exc.code, exc.message)
        except Exception:
            await database_call(self.store.fail, run_id, 'analysis_failed', 'Analysis could not finish. Retry the analysis.')
