import shutil
import time
from pathlib import Path

TTL_SECONDS = 24 * 60 * 60


def cleanup_old_data(data_dir: Path, ttl_seconds: int = TTL_SECONDS) -> None:
    if not data_dir.exists():
        return
    now = time.time()
    for entry in data_dir.iterdir():
        if not entry.is_dir():
            continue
        try:
            age = now - entry.stat().st_mtime
        except FileNotFoundError:
            continue
        if age > ttl_seconds:
            shutil.rmtree(entry, ignore_errors=True)
