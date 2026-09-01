import asyncio

from app.models import Job

_queues: dict[str, list[asyncio.Queue]] = {}


def subscribe(job_id: str) -> asyncio.Queue:
    queue: asyncio.Queue = asyncio.Queue()
    _queues.setdefault(job_id, []).append(queue)
    return queue


def unsubscribe(job_id: str, queue: asyncio.Queue) -> None:
    subscribers = _queues.get(job_id)
    if subscribers and queue in subscribers:
        subscribers.remove(queue)
        if not subscribers:
            _queues.pop(job_id, None)


def publish_update(job_id: str, job: Job | None) -> None:
    if job is None:
        return
    for queue in _queues.get(job_id, []):
        queue.put_nowait(job)
