import asyncio
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app import jobs
from app.models import Job
from app.pubsub import publish_update
from app.services.demucs import separate as run_separation

router = APIRouter()

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
OUTPUTS_DIR = DATA_DIR / "outputs"

ALLOWED_CONTENT_TYPES = {
    "audio/mpeg",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/flac",
    "audio/x-flac",
    "audio/mp4",
    "audio/aac",
    "audio/ogg",
    "audio/webm",
}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # ~15 min of typical compressed audio
DEFAULT_MODEL = "htdemucs"


@router.post("/api/separate", status_code=202)
async def create_separation(file: UploadFile, model: str = DEFAULT_MODEL):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    job = jobs.create_job()
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    input_path = UPLOADS_DIR / f"{job.id}{Path(file.filename or '').suffix}"

    size = 0
    with input_path.open("wb") as out:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                out.close()
                input_path.unlink(missing_ok=True)
                jobs.set_error(job.id, "File too large")
                raise HTTPException(status_code=400, detail="File too large")
            out.write(chunk)

    output_dir = OUTPUTS_DIR / job.id
    loop = asyncio.get_running_loop()

    def progress_cb(progress: float) -> None:
        loop.call_soon_threadsafe(_on_progress, job.id, progress)

    def run() -> None:
        try:
            stem_paths = run_separation(input_path, output_dir, model, progress_cb)
            loop.call_soon_threadsafe(
                _on_done, job.id, {name: str(path) for name, path in stem_paths.items()}
            )
        except Exception as exc:  # noqa: BLE001
            loop.call_soon_threadsafe(_on_error, job.id, str(exc))

    loop.run_in_executor(None, run)

    return {"job_id": job.id}


def _on_progress(job_id: str, progress: float) -> None:
    jobs.set_progress(job_id, progress)
    publish_update(job_id, jobs.get_job(job_id))


def _on_done(job_id: str, stem_paths: dict[str, str]) -> None:
    jobs.set_done(job_id, stem_paths)
    publish_update(job_id, jobs.get_job(job_id))


def _on_error(job_id: str, error: str) -> None:
    jobs.set_error(job_id, error)
    publish_update(job_id, jobs.get_job(job_id))


@router.get("/api/jobs/{job_id}", response_model=Job)
def get_job(job_id: str) -> Job:
    job = jobs.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/api/jobs/{job_id}/stems/{stem_name}")
def get_stem(job_id: str, stem_name: str) -> FileResponse:
    job = jobs.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.stem_paths is None or stem_name not in job.stem_paths:
        raise HTTPException(status_code=404, detail="Stem not ready")
    return FileResponse(job.stem_paths[stem_name], media_type="audio/wav")
