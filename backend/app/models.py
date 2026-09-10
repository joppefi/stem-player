import time
from enum import Enum

from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    QUEUED = "queued"
    DOWNLOADING = "downloading"
    PROCESSING = "processing"
    DONE = "done"
    ERROR = "error"


class Job(BaseModel):
    id: str
    status: JobStatus = JobStatus.QUEUED
    progress: float = 0.0
    title: str | None = None
    stem_paths: dict[str, str] | None = None
    analysis_path: str | None = None
    error: str | None = None
    created_at: float = Field(default_factory=time.time)


class SongSummary(BaseModel):
    name: str
    stems: list[str]
    has_analysis: bool


class SongAnalysis(BaseModel):
    key: str
    bpm: float
    first_beat: float
    duration: float


class ConfigResponse(BaseModel):
    data_dir: str
