from pathlib import Path
from typing import Callable

import yt_dlp

MAX_DURATION_SECONDS = 15 * 60


class DownloadError(Exception):
    pass


def download_audio(
    url: str,
    output_dir: Path,
    progress_cb: Callable[[float], None],
) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)

    probe_opts = {"quiet": True, "no_warnings": True, "noplaylist": True}
    try:
        with yt_dlp.YoutubeDL(probe_opts) as probe:
            info = probe.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as exc:
        raise DownloadError(str(exc)) from exc

    duration = info.get("duration") if info else None
    if duration and duration > MAX_DURATION_SECONDS:
        raise DownloadError(
            f"Video is too long ({duration // 60} min); max is {MAX_DURATION_SECONDS // 60} min"
        )

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
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
    except yt_dlp.utils.DownloadError as exc:
        raise DownloadError(str(exc)) from exc

    progress_cb(1.0)

    result = output_dir / "audio.wav"
    if not result.exists():
        raise DownloadError("Download did not produce an audio file")
    return result
