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
