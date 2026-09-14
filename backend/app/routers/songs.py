import json
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, Response

from app.models import Job, JobStatus, Label, LabelCreate, SongAnalysis, SongSummary
from app.paths import DATA_DIR, STEM_NAMES
from app.services.analysis import find_original_file, run_analysis_for_folder
from app.services.waveform import generate_waveform_png

logger = logging.getLogger(__name__)

router = APIRouter()


def _find_song_dir(song_id: str) -> Path | None:
    """Find a DATA_DIR folder ending in '(<song_id>)' with all 4 stems present."""
    if not DATA_DIR.exists():
        return None
    suffix = f"({song_id})"
    for entry in DATA_DIR.iterdir():
        if not entry.is_dir() or not entry.name.endswith(suffix):
            continue
        if all((entry / f"{name}.wav").is_file() for name in STEM_NAMES):
            return entry
    return None


@router.get("/api/songs", response_model=list[SongSummary])
def list_songs() -> list[SongSummary]:
    """List every already-separated song: a DATA_DIR subfolder with all 4 stems."""
    if not DATA_DIR.exists():
        return []

    entries: list[tuple[float, SongSummary]] = []
    for entry in DATA_DIR.iterdir():
        if not entry.is_dir():
            continue
        if not all((entry / f"{name}.wav").is_file() for name in STEM_NAMES):
            continue
        try:
            mtime = entry.stat().st_mtime
        except FileNotFoundError:
            continue
        has_analysis = (entry / "analysis.json").is_file()
        entries.append(
            (
                mtime,
                SongSummary(
                    name=entry.name, stems=list(STEM_NAMES), has_analysis=has_analysis
                ),
            )
        )

    entries.sort(key=lambda pair: pair[0], reverse=True)
    return [summary for _, summary in entries]


@router.get("/api/songs/{song_id}", response_model=Job)
def get_song(song_id: str) -> Job:
    """Look up an already-separated song by the trailing id in its folder name."""
    song_dir = _find_song_dir(song_id)
    if song_dir is None:
        raise HTTPException(status_code=404, detail="Song not found")

    stem_paths = {name: str(song_dir / f"{name}.wav") for name in STEM_NAMES}
    analysis_path = song_dir / "analysis.json"
    return Job(
        id=song_id,
        status=JobStatus.DONE,
        progress=1.0,
        title=song_dir.name,
        stem_paths=stem_paths,
        analysis_path=str(analysis_path) if analysis_path.is_file() else None,
        created_at=song_dir.stat().st_mtime,
    )


@router.get("/api/songs/{song_id}/stems/{stem_name}")
def get_song_stem(song_id: str, stem_name: str) -> FileResponse:
    song_dir = _find_song_dir(song_id)
    if song_dir is None or stem_name not in STEM_NAMES:
        raise HTTPException(status_code=404, detail="Song not found")
    stem_path = song_dir / f"{stem_name}.wav"
    if not stem_path.is_file():
        raise HTTPException(status_code=404, detail="Stem not found")
    return FileResponse(stem_path, media_type="audio/wav")


@router.get("/api/songs/{song_id}/stems/{stem_name}/waveform")
def get_song_waveform(
    song_id: str, stem_name: str, width: int = 600, height: int = 80
) -> Response:
    song_dir = _find_song_dir(song_id)
    if song_dir is None or stem_name not in STEM_NAMES:
        raise HTTPException(status_code=404, detail="Song not found")
    stem_path = song_dir / f"{stem_name}.wav"
    if not stem_path.is_file():
        raise HTTPException(status_code=404, detail="Stem not found")
    png_bytes = generate_waveform_png(stem_path, width, height)
    return Response(content=png_bytes, media_type="image/png")


@router.get("/api/songs/{song_id}/analysis", response_model=SongAnalysis)
def get_song_analysis(song_id: str) -> SongAnalysis:
    song_dir = _find_song_dir(song_id)
    if song_dir is None:
        raise HTTPException(status_code=404, detail="Song not found")

    analysis_path = song_dir / "analysis.json"
    if analysis_path.is_file():
        return FileResponse(
            analysis_path,
            media_type="application/json",
            headers={"Cache-Control": "no-cache"},
        )

    original = find_original_file(song_dir)
    if original is None:
        raise HTTPException(
            status_code=404, detail="Original audio not found for analysis"
        )

    logger.info("Song %s: analysis missing, generating on request", song_id)
    saved_path = run_analysis_for_folder(original, song_dir, f"Song {song_id}")
    if saved_path is None:
        raise HTTPException(status_code=500, detail="Analysis failed")

    return FileResponse(
        saved_path,
        media_type="application/json",
        headers={"Cache-Control": "no-cache"},
    )


def _labels_path(song_dir: Path) -> Path:
    return song_dir / "labels.json"


def _read_labels(song_dir: Path) -> list[Label]:
    path = _labels_path(song_dir)
    if not path.is_file():
        return []
    return [Label(**entry) for entry in json.loads(path.read_text())]


def _write_labels(song_dir: Path, labels: list[Label]) -> None:
    path = _labels_path(song_dir)
    path.write_text(json.dumps([label.model_dump() for label in labels]))


@router.get("/api/songs/{song_id}/labels", response_model=list[Label])
def list_song_labels(song_id: str) -> list[Label]:
    song_dir = _find_song_dir(song_id)
    if song_dir is None:
        raise HTTPException(status_code=404, detail="Song not found")
    return _read_labels(song_dir)


@router.post("/api/songs/{song_id}/labels", response_model=Label)
def create_song_label(song_id: str, body: LabelCreate) -> Label:
    song_dir = _find_song_dir(song_id)
    if song_dir is None:
        raise HTTPException(status_code=404, detail="Song not found")
    if body.start >= body.end:
        raise HTTPException(status_code=400, detail="start must be before end")

    labels = _read_labels(song_dir)
    label = Label(id=str(uuid.uuid4()), name=body.name, start=body.start, end=body.end)
    labels.append(label)
    _write_labels(song_dir, labels)
    return label


@router.put("/api/songs/{song_id}/labels/{label_id}", response_model=Label)
def update_song_label(song_id: str, label_id: str, body: LabelCreate) -> Label:
    song_dir = _find_song_dir(song_id)
    if song_dir is None:
        raise HTTPException(status_code=404, detail="Song not found")
    if body.start >= body.end:
        raise HTTPException(status_code=400, detail="start must be before end")

    labels = _read_labels(song_dir)
    for i, existing in enumerate(labels):
        if existing.id == label_id:
            updated = Label(id=label_id, name=body.name, start=body.start, end=body.end)
            labels[i] = updated
            _write_labels(song_dir, labels)
            return updated
    raise HTTPException(status_code=404, detail="Label not found")


@router.delete("/api/songs/{song_id}/labels/{label_id}", status_code=204)
def delete_song_label(song_id: str, label_id: str) -> Response:
    song_dir = _find_song_dir(song_id)
    if song_dir is None:
        raise HTTPException(status_code=404, detail="Song not found")

    labels = _read_labels(song_dir)
    remaining = [label for label in labels if label.id != label_id]
    if len(remaining) == len(labels):
        raise HTTPException(status_code=404, detail="Label not found")

    _write_labels(song_dir, remaining)
    return Response(status_code=204)
