# Stem Player

Local stem separation app: FastAPI + Demucs backend, React Router (SPA) frontend.

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

Uploaded/downloaded audio and separated stems are written to `backend/data/`
(`uploads/` and `outputs/`) by default. Set `STEM_PLAYER_DATA_DIR` to point
this elsewhere, e.g.:

```bash
STEM_PLAYER_DATA_DIR=/Volumes/External/stem-player-data .venv/bin/uvicorn app.main:app --port 8000
```

Files persist across restarts on their own — nothing deletes them except a
24h TTL cleanup that runs at startup (`app/cleanup.py`). Note that job
*status* (progress, which stems belong to which job) is only kept in memory
and is lost on restart, even though the stem files themselves remain on disk.
