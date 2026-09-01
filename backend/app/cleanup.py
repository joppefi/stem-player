import shutil
import time
from pathlib import Path

TTL_SECONDS = 24 * 60 * 60


def cleanup_old_data(data_dir: Path, ttl_seconds: int = TTL_SECONDS) -> None:
    now = time.time()
    for subdir_name in ("uploads", "outputs"):
        subdir = data_dir / subdir_name
        if not subdir.exists():
            continue
        for entry in subdir.iterdir():
            try:
                age = now - entry.stat().st_mtime
            except FileNotFoundError:
                continue
            if age <= ttl_seconds:
                continue
            if entry.is_dir():
                shutil.rmtree(entry, ignore_errors=True)
            else:
                entry.unlink(missing_ok=True)
