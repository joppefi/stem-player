import logging
import sys
from pathlib import Path
from typing import Callable

import yt_dlp

logger = logging.getLogger(__name__)

MAX_DURATION_SECONDS = 15 * 60


class DownloadError(Exception):
    pass


def _bundled_ffmpeg_location() -> str | None:
    """Path to a bundled ffmpeg, if one was shipped alongside a frozen build
    (see stem-player.spec / build_binary_osx.sh / build_binary_windows.ps1).
    Outside a frozen build -- or if no binary was placed in
    backend/resources/ffmpeg before building -- this returns None and
    yt-dlp falls back to whatever's on PATH, same as today.

    This points at the containing directory rather than the binary itself:
    yt-dlp resolves "<dir>/ffmpeg" per-platform from there, and on Windows
    the OS process launcher appends ".exe" automatically when a bare name
    is given -- so the same resources/ffmpeg/ffmpeg(.exe) layout works on
    both platforms without an OS check here.
    """
    if not getattr(sys, "frozen", False):
        return None
    candidate = Path(sys.executable).resolve().parent / "resources" / "ffmpeg"
    return str(candidate) if candidate.exists() else None


def probe(url: str) -> dict:
    """Fetch video metadata (title, id, duration) without downloading."""
    opts = {"quiet": True, "no_warnings": True, "noplaylist": True}
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as exc:
        logger.warning("Probe failed: %s (%s)", url, exc)
        raise DownloadError(str(exc)) from exc

    if info is None:
        raise DownloadError("Could not read video info")

    duration = info.get("duration")
    if duration and duration > MAX_DURATION_SECONDS:
        raise DownloadError(
            f"Video is too long ({duration // 60} min); max is {MAX_DURATION_SECONDS // 60} min"
        )

    return info


def download_audio(
    url: str,
    output_dir: Path,
    progress_cb: Callable[[float], None],
) -> Path:
    logger.info("Download started: %s", url)
    output_dir.mkdir(parents=True, exist_ok=True)

    def hook(d: dict) -> None:
        if d.get("status") != "downloading":
            return
        total = d.get("total_bytes") or d.get("total_bytes_estimate")
        downloaded = d.get("downloaded_bytes", 0)
        if total:
            progress_cb(min(1.0, downloaded / total))

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": str(output_dir / "audio.%(ext)s"),
        "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "wav"}],
        "progress_hooks": [hook],
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
    }
    ffmpeg_location = _bundled_ffmpeg_location()
    if ffmpeg_location:
        ydl_opts["ffmpeg_location"] = ffmpeg_location
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
    except yt_dlp.utils.DownloadError as exc:
        logger.warning("Download failed: %s (%s)", url, exc)
        raise DownloadError(str(exc)) from exc

    progress_cb(1.0)

    result = output_dir / "audio.wav"
    if not result.exists():
        raise DownloadError("Download did not produce an audio file")

    logger.info("Download completed: %s -> %s", url, result)
    return result
