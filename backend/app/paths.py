import os
import sys
from pathlib import Path

if getattr(sys, "frozen", False):
    # Inside a PyInstaller bundle, __file__ resolves into the temp extraction
    # dir -- default to a "data" folder next to the executable instead, so
    # it's persistent and user-visible.
    _DEFAULT_DATA_DIR = Path(sys.executable).resolve().parent / "data"
else:
    _DEFAULT_DATA_DIR = Path(__file__).resolve().parents[1] / "data"

# Each job gets its own folder directly under DATA_DIR (named after the song),
# holding both the original file and the separated stems.
DATA_DIR = Path(os.environ.get("STEM_PLAYER_DATA_DIR", _DEFAULT_DATA_DIR)).expanduser().resolve()

STEM_NAMES = ("vocals", "drums", "bass", "other")
