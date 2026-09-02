import threading
import uuid

from app.models import Job, JobStatus

_lock = threading.Lock()
_jobs: dict[str, Job] = {}


def create_job() -> Job:
    job = Job(id=str(uuid.uuid4()))
    with _lock:
        _jobs[job.id] = job
    return job


def get_job(job_id: str) -> Job | None:
    with _lock:
        return _jobs.get(job_id)


def update_job(job_id: str, **fields) -> Job | None:
    with _lock:
        job = _jobs.get(job_id)
        if job is None:
            return None
        updated = job.model_copy(update=fields)
        _jobs[job_id] = updated
        return updated


def set_downloading(job_id: str, progress: float) -> None:
    update_job(job_id, status=JobStatus.DOWNLOADING, progress=progress)


def set_progress(job_id: str, progress: float) -> None:
    update_job(job_id, status=JobStatus.PROCESSING, progress=progress)


def set_done(
    job_id: str, stem_paths: dict[str, str], analysis_path: str | None = None
) -> None:
    update_job(
        job_id,
        status=JobStatus.DONE,
        progress=1.0,
        stem_paths=stem_paths,
        analysis_path=analysis_path,
    )


def set_error(job_id: str, error: str) -> None:
    update_job(job_id, status=JobStatus.ERROR, error=error)
