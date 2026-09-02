import asyncio
import logging
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi import APIRouter, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app import jobs
from app.models import Job
from app.paths import OUTPUTS_DIR, UPLOADS_DIR
from app.pubsub import publish_update
from app.services.demucs import separate as run_separation
from app.services.youtube import DownloadError, download_audio

logger = logging.getLogger(__name__)

router = APIRouter()

# A single worker serializes Demucs runs (one model instance at a time on typical
# local hardware) and gives us a handle to cancel queued-but-not-started jobs on shutdown.
_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="demucs")


def shutdown_executor() -> None:
    _executor.shutdown(wait=False, cancel_futures=True)


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
YOUTUBE_URL_RE = re.compile(
    r"^https?://(www\.)?(youtube\.com/(watch\?v=|shorts/)|youtu\.be/)", re.IGNORECASE
)


@router.post("/api/separate", status_code=202)
async def create_separation(
    file: UploadFile | None = None,
    youtube_url: str | None = Form(None),
    model: str = DEFAULT_MODEL,
):
    if (file is None) == (youtube_url is None):
        raise HTTPException(
            status_code=400, detail="Provide exactly one of file or youtube_url"
        )

    if file is not None and file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    if youtube_url is not None and not YOUTUBE_URL_RE.match(youtube_url):
        raise HTTPException(status_code=400, detail="Not a valid YouTube URL")

    job = jobs.create_job()
    output_dir = OUTPUTS_DIR / job.id
    loop = asyncio.get_running_loop()

    def progress_cb(progress: float) -> None:
        loop.call_soon_threadsafe(_on_progress, job.id, progress)

    def download_progress_cb(progress: float) -> None:
        loop.call_soon_threadsafe(_on_downloading, job.id, progress)

    if file is not None:
        UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        input_path = UPLOADS_DIR / f"{job.id}{Path(file.filename or '').suffix}"
        logger.info(
            "Job %s: saving upload to %s, stems will be written to %s",
            job.id,
            input_path,
            output_dir,
        )

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

        def run() -> None:
            try:
                stem_paths = run_separation(input_path, output_dir, model, progress_cb)
                loop.call_soon_threadsafe(
                    _on_done, job.id, {name: str(path) for name, path in stem_paths.items()}
                )
            except Exception as exc:  # noqa: BLE001
                loop.call_soon_threadsafe(_on_error, job.id, str(exc))

    else:
        download_dir = UPLOADS_DIR / job.id
        logger.info(
            "Job %s: downloading %s to %s, stems will be written to %s",
            job.id,
            youtube_url,
            download_dir,
            output_dir,
        )

        def run() -> None:
            try:
                input_path = download_audio(youtube_url, download_dir, download_progress_cb)
                stem_paths = run_separation(input_path, output_dir, model, progress_cb)
                loop.call_soon_threadsafe(
                    _on_done, job.id, {name: str(path) for name, path in stem_paths.items()}
                )
            except DownloadError as exc:
                loop.call_soon_threadsafe(_on_error, job.id, f"Download failed: {exc}")
            except Exception as exc:  # noqa: BLE001
                loop.call_soon_threadsafe(_on_error, job.id, str(exc))

    loop.run_in_executor(_executor, run)

    return {"job_id": job.id}


def _on_downloading(job_id: str, progress: float) -> None:
    jobs.set_downloading(job_id, progress)
    publish_update(job_id, jobs.get_job(job_id))


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
