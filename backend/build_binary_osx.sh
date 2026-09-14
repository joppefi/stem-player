#!/usr/bin/env bash
# Builds the frontend, then the PyInstaller binary bundle. macOS/Linux --
# use build_binary_windows.ps1 on Windows. PyInstaller does not
# cross-compile, so this must be run on the OS you want a binary for.
#
# Requires `pyinstaller` installed in the active Python environment
# (pip install -e ".[dev]" from backend/, see pyproject.toml).
#
# To let YouTube downloads work in the built binary, drop a static ffmpeg
# binary at backend/resources/ffmpeg before running this script (see
# app/services/youtube.py's _bundled_ffmpeg_location) -- otherwise the
# binary falls back to requiring ffmpeg on the target machine's PATH.
set -euo pipefail

cd "$(dirname "$0")"

echo "Building frontend..."
(cd ../frontend && npm run build)

echo "Building binary with PyInstaller..."
pyinstaller --noconfirm stem-player.spec

echo "Done: dist/stem-player/"
