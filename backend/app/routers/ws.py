from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app import jobs
from app.models import JobStatus
from app.pubsub import subscribe, unsubscribe

router = APIRouter()


@router.websocket("/ws/jobs/{job_id}")
async def job_updates(websocket: WebSocket, job_id: str) -> None:
    await websocket.accept()

    job = jobs.get_job(job_id)
    if job is None:
        await websocket.close(code=4404, reason="Job not found")
        return

    queue = subscribe(job_id)
    try:
        await websocket.send_json(job.model_dump())
        if job.status in (JobStatus.DONE, JobStatus.ERROR):
            return

        while True:
            updated = await queue.get()
            await websocket.send_json(updated.model_dump())
            if updated.status in (JobStatus.DONE, JobStatus.ERROR):
                break
    except WebSocketDisconnect:
        pass
    finally:
        unsubscribe(job_id, queue)
