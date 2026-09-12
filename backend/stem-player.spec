# PyInstaller spec for the Stem Player binary.
#
# Run via backend/build_binary_osx.sh (macOS/Linux) or
# backend/build_binary_windows.ps1 (Windows), which build the frontend
# first (this spec's `datas` bundles frontend/build/client, so it must
# already exist). PyInstaller does not cross-compile -- build on the OS
# you want a binary for.
#
# --onedir (not --onefile): torch/torchaudio/demucs/librosa/matplotlib are
# several GB combined -- a --onefile build would re-extract all of that into
# a temp dir on every launch. --onedir just runs the unpacked folder in
# place.
#
# collect_all(...) for the ML/audio packages below: PyInstaller's static
# import scanner is known to miss their dynamic imports and C extensions.

import sys

from PyInstaller.utils.hooks import collect_all

datas = [("../frontend/build/client", "frontend_dist")]
binaries = []
hiddenimports = []

collect_pkgs = ["torch", "torchaudio", "demucs", "librosa", "matplotlib", "webview"]
if sys.platform == "win32":
    # pywebview's default Windows backend (WebView2/WinForms) goes through
    # pythonnet's .NET interop, which PyInstaller's scanner can't follow.
    collect_pkgs.append("pythonnet")

for pkg in collect_pkgs:
    pkg_datas, pkg_binaries, pkg_hiddenimports = collect_all(pkg)
    datas += pkg_datas
    binaries += pkg_binaries
    hiddenimports += pkg_hiddenimports

a = Analysis(
    ["run.py"],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="stem-player",
    debug=False,
    strip=False,
    upx=False,
    console=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="stem-player",
)
