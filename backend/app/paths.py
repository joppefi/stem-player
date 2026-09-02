import os
from pathlib import Path

_DEFAULT_DATA_DIR = Path(__file__).resolve().parents[1] / "data"

# Each job gets its own folder directly under DATA_DIR (named after the song),
# holding both the original file and the separated stems.
DATA_DIR = Path(os.environ.get("STEM_PLAYER_DATA_DIR", _DEFAULT_DATA_DIR)).expanduser().resolve()
