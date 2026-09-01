from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.cleanup import cleanup_old_data
from app.paths import DATA_DIR
from app.routers import separate, ws
from app.routers.separate import shutdown_executor


@asynccontextmanager
async def lifespan(app: FastAPI):
    cleanup_old_data(DATA_DIR)
    yield
    shutdown_executor()


app = FastAPI(title="Stem Player", lifespan=lifespan)

app.include_router(separate.router)
app.include_router(ws.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "build" / "client"

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str) -> FileResponse:
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
