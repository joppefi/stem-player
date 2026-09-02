import re
from pathlib import Path

_INVALID_CHARS = re.compile(r'[\\/:*?"<>|\x00-\x1f]')
_MAX_LENGTH = 150


def sanitize_name(name: str) -> str:
    name = _INVALID_CHARS.sub("_", name)
    name = re.sub(r"\s+", " ", name).strip().strip(".")
    if not name:
        name = "untitled"
    return name[:_MAX_LENGTH]


def unique_dir(parent: Path, name: str) -> Path:
    candidate = parent / name
    counter = 2
    while candidate.exists():
        candidate = parent / f"{name} ({counter})"
        counter += 1
    return candidate
