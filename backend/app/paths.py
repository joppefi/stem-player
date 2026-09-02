import os
from pathlib import Path

_DEFAULT_DATA_DIR = Path(__file__).resolve().parents[1] / "data"

DATA_DIR = Path(os.environ.get("STEM_PLAYER_DATA_DIR", _DEFAULT_DATA_DIR)).expanduser().resolve()
UPLOADS_DIR = DATA_DIR / "uploads"
OUTPUTS_DIR = DATA_DIR / "outputs"
