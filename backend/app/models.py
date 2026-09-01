from enum import Enum

from pydantic import BaseModel


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
    stem_paths: dict[str, str] | None = None
    error: str | None = None
