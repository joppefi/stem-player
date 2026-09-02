import asyncio
import logging
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi import APIRouter, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response

from app import jobs
from app.models import Job
from app.naming import sanitize_name, unique_dir
from app.paths import DATA_DIR
from app.pubsub import publish_update
from app.services.demucs import separate as run_separation
from app.services.waveform import generate_waveform_png
from app.services.youtube import DownloadError, download_audio, probe

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
STEM_NAMES = ("vocals", "drums", "bass", "other")
YOUTUBE_URL_RE = re.compile(
    r"^https?://(?:www\.)?(?:youtube\.com/(?:watch\?v=|shorts/)|youtu\.be/)"
    r"(?P<video_id>[A-Za-z0-9_-]{11})",
    re.IGNORECASE,
)


def _find_existing_stems(video_id: str) -> dict[str, str] | None:
    """Look for a folder already named '... (<video_id>)' with all stems present."""
    if not DATA_DIR.exists():
        return None
    suffix = f"({video_id})"
    for entry in DATA_DIR.iterdir():
        if not entry.is_dir() or not entry.name.endswith(suffix):
            continue
        stem_paths = {name: entry / f"{name}.wav" for name in STEM_NAMES}
        if all(path.is_file() for path in stem_paths.values()):
            return {name: str(path) for name, path in stem_paths.items()}
    return None


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

    youtube_match = YOUTUBE_URL_RE.match(youtube_url) if youtube_url is not None else None
    if youtube_url is not None and youtube_match is None:
        raise HTTPException(status_code=400, detail="Not a valid YouTube URL")

    job = jobs.create_job()
    loop = asyncio.get_running_loop()

    def progress_cb(progress: float) -> None:
        loop.call_soon_threadsafe(_on_progress, job.id, progress)

    def download_progress_cb(progress: float) -> None:
        loop.call_soon_threadsafe(_on_downloading, job.id, progress)

    if file is not None:
        original_stem = sanitize_name(Path(file.filename or "audio").stem)
        suffix = Path(file.filename or "").suffix or ".bin"
        job_dir = unique_dir(DATA_DIR, f"{original_stem} ({job.id})")
        job_dir.mkdir(parents=True, exist_ok=True)
        input_path = job_dir / f"{original_stem}{suffix}"
        logger.info("Job %s: saving upload to %s", job.id, input_path)

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
                stem_paths = run_separation(input_path, job_dir, model, progress_cb)
                loop.call_soon_threadsafe(
                    _on_done, job.id, {name: str(path) for name, path in stem_paths.items()}
                )
            except Exception as exc:  # noqa: BLE001
                loop.call_soon_threadsafe(_on_error, job.id, str(exc))

    else:
        video_id = youtube_match.group("video_id")
        existing_stems = _find_existing_stems(video_id)
        if existing_stems is not None:
            logger.info(
                "Job %s: video %s already downloaded and separated, reusing existing stems",
                job.id,
                video_id,
            )
            jobs.set_done(job.id, existing_stems)
            return {"job_id": job.id}

        def run() -> None:
            try:
                info = probe(youtube_url)
                title = sanitize_name(info.get("title") or "video")
                video_id = info.get("id") or job.id
                job_dir = unique_dir(DATA_DIR, f"{title} ({video_id})")
                logger.info("Job %s: downloading %s to %s", job.id, youtube_url, job_dir)
                input_path = download_audio(youtube_url, job_dir, download_progress_cb)
                stem_paths = run_separation(input_path, job_dir, model, progress_cb)
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


@router.get("/api/jobs/{job_id}/stems/{stem_name}/waveform")
def get_waveform(job_id: str, stem_name: str, width: int = 600, height: int = 80) -> Response:
    job = jobs.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.stem_paths is None or stem_name not in job.stem_paths:
        raise HTTPException(status_code=404, detail="Stem not ready")
    png_bytes = generate_waveform_png(Path(job.stem_paths[stem_name]), width, height)
    return Response(content=png_bytes, media_type="image/png")
