from fastapi import FastAPI

from app.routers import separate, ws

app = FastAPI(title="Stem Player")

app.include_router(separate.router)
app.include_router(ws.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
