# Building the Windows binary

PyInstaller does not cross-compile, so this has to be run **on a Windows
machine** — you can't produce a `.exe` from macOS/Linux.

## Prerequisites

- Python 3.10+ on `PATH`
- Node.js/npm (for the frontend build)
- This repo, cloned or copied over

## 1. Set up the Python environment

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
```

`.[dev]` pulls in `pyinstaller` alongside the normal runtime dependencies
(`pyproject.toml`).

### If `Activate.ps1` is blocked

PowerShell blocks running scripts by default — this is a general Windows
policy, not specific to this project:

```
File ...\.venv\Scripts\Activate.ps1 cannot be loaded because running
scripts is disabled on this system.
```

Fix for just the current session:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.venv\Scripts\Activate.ps1
```

Or permanently for your user account:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Alternatively, skip activation and call the venv's executables directly:
`.venv\Scripts\pip.exe install -e ".[dev]"`, etc.

## 2. Run the build

```powershell
.\build_binary_windows.ps1
```

This runs `npm run build` in `frontend/` first, then
`pyinstaller --noconfirm stem-player.spec`. Output lands in
`backend\dist\stem-player\`.

This is a heavy build (torch, torchaudio, demucs, librosa, matplotlib all
have to be collected) and can take a couple of minutes.

## 3. ffmpeg

The app needs `ffmpeg` (and `ffprobe`) for two separate things, and only
one of them is currently wired to look anywhere other than the system
`PATH`:

- **YouTube download** (`app/services/youtube.py`) explicitly checks for a
  bundled binary at `resources\ffmpeg\` next to the executable
  (`_bundled_ffmpeg_location()`), falling back to `PATH` if that's not
  there.
- **Stem separation** (via Demucs' `AudioFile.read()`, in the `demucs`
  package itself, not our code) shells out to bare `ffmpeg`/`ffprobe`
  with **no path configured at all** — it only works via Windows' normal
  process-launch search.

Windows searches, in order: the directory containing the _running .exe_,
current directory, system directories, then `PATH`. So the one placement
that satisfies **both** call sites without any code changes is:

**Put `ffmpeg.exe` and `ffprobe.exe` directly in `dist\stem-player\`, next
to `stem-player.exe` itself** — not in a `resources\ffmpeg\` subfolder.
This can be done after the build, and doesn't require rebuilding if you
swap the binaries later.

(If neither placed there nor on system `PATH`, YouTube download and stem
separation will fail — song upload, playback, and everything else works
regardless, since they don't touch ffmpeg.)

## 4. Run it

```powershell
dist\stem-player\stem-player.exe
```

Then open `http://127.0.0.1:8000`. A `data\` folder is created next to the
executable for downloaded songs and separated stems (override with the
`STEM_PLAYER_DATA_DIR` env var, same as running from source).

## Troubleshooting

- **`[WinError 2] The system cannot find the file specified`** during the
  separation phase: almost always `ffmpeg.exe`/`ffprobe.exe` not being
  where Demucs' bare subprocess call can find them — see the ffmpeg
  section above. Confirm both binaries are directly in `dist\stem-player\`
  (or on system `PATH`).
- **`ModuleNotFoundError` at runtime**, not at build time: PyInstaller's
  static import scanner missed a dynamic import from one of the ML
  packages. `stem-player.spec` already uses `collect_all(...)` for
  `torch`, `torchaudio`, `demucs`, `librosa`, and `matplotlib` to cover
  the packages known to need this — if a new one shows up, add the
  missing package name to that same loop.
