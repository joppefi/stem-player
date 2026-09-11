# Builds the frontend, then the PyInstaller binary bundle. Windows --
# use build_binary_osx.sh on macOS/Linux. PyInstaller does not
# cross-compile, so this must be run on the OS you want a binary for.
#
# Requires `pyinstaller` installed in the active Python environment
# (pip install -e ".[dev]" from backend/, see pyproject.toml).
#
# To let YouTube downloads work in the built binary, drop a static
# ffmpeg.exe at backend/resources/ffmpeg/ffmpeg.exe before running this
# script (see app/services/youtube.py's _bundled_ffmpeg_location) --
# otherwise the binary falls back to requiring ffmpeg on the target
# machine's PATH.

$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

Write-Host "Building frontend..."
Push-Location ../frontend
npm run build
Pop-Location

Write-Host "Building binary with PyInstaller..."
pyinstaller --noconfirm stem-player.spec

Write-Host "Done: dist/stem-player/"
