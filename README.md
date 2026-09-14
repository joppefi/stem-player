# Stem Player

Local stem separation and player app: FastAPI + Demucs backend, React Router (SPA) frontend, bundled with PyInstaller.

## Setup

```bash
# Backend
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Frontend
cd ../frontend
npm install

# Root
cd ..
npm install
```

## Development

From the repo root:

```bash
npm run dev
```

This runs the FastAPI backend (`uvicorn --reload` on port 8000) and the Vite dev server
(with `/api` and `/ws` proxied to the backend) concurrently.

## Production

```bash
cd frontend && npm run build
cd ../backend && .venv/bin/uvicorn app.main:app --port 8000
```

The backend serves the built frontend from `frontend/build/client` on the same port.

## Data storage

Each job gets its own folder directly under `backend/data/`, named after the
song, containing the original upload/download alongside all four separated
stems:

- Uploaded file: `<original filename> (<job id>)/`
- YouTube download: `<video title> (<video id>)/`

e.g. `Mamba - Vielä on kesää jäljellä (Wnkc9h3IMUA)/` containing `audio.wav`,
`vocals.wav`, `drums.wav`, `bass.wav`, `other.wav`. If a folder name is
already taken (e.g. the same YouTube video downloaded twice), a ` (2)`, ` (3)`
etc. suffix is appended.

Set `STEM_PLAYER_DATA_DIR` to point the whole library elsewhere, e.g.:

```bash
STEM_PLAYER_DATA_DIR=~/Music/StemPlayer .venv/bin/uvicorn app.main:app --port 8000
```

Files persist across restarts, and nothing ever deletes them automatically —
clean up old song folders yourself if you want to reclaim space. Note that
job _status_ (progress, which stems belong to which job) is only kept in
memory and is lost on restart, even though the files themselves remain on
disk.
