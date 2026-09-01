from fastapi import FastAPI

app = FastAPI(title="Stem Player")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
