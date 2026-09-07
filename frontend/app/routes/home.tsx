import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import type { Route } from "./+types/home";
import { MODELS, type Job, type JobStatus } from "../types";
import { useListSongs } from "~/api/hooks.generated";

// Song folders are named "<title> (<id>)" -- for YouTube-sourced songs that id
// is the 11-char video id, which can be resubmitted as youtube_url to hit the
// backend's dedup path (POST /api/separate) and get back an instant "done" job.
// Upload-sourced songs end in a job UUID instead, which doesn't match, so no
// button renders for those.
const VIDEO_ID_RE = /\(([A-Za-z0-9_-]{11})\)$/;

function extractVideoId(songName: string): string | null {
  return VIDEO_ID_RE.exec(songName)?.[1] ?? null;
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Stem Player" },
    {
      name: "description",
      content: "Split a song into vocals, drums, bass, and other.",
    },
  ];
}

export default function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"file" | "youtube">("youtube");
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [model, setModel] = useState<string>(MODELS[0].value);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: songs } = useListSongs();

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function fetchJobs() {
      try {
        const res = await fetch("/api/jobs");
        if (!res.ok || cancelled) return;
        const data: Job[] = await res.json();
        if (cancelled) return;
        setJobs(data);
        // Keep polling only while something is actually in flight, so the list
        // stays live for active jobs without hitting the backend forever.
        const hasActiveJob = data.some((job) =>
          (["queued", "downloading", "processing"] as JobStatus[]).includes(
            job.status,
          ),
        );
        if (hasActiveJob) {
          timeoutId = setTimeout(fetchJobs, 3000);
        }
      } catch {
        // ignore; next visit to this page will retry
      }
    }

    void fetchJobs();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  async function submit(formData: FormData) {
    setError(null);
    setIsUploading(true);
    try {
      const response = await fetch(
        `/api/separate?model=${encodeURIComponent(model)}`,
        {
          method: "POST",
          body: formData,
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? `Request failed (${response.status})`);
      }
      const { job_id } = await response.json();
      navigate(`/jobs/${job_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setIsUploading(false);
    }
  }

  function handleFiles(files: FileList | null) {
    const selected = files?.[0];
    if (!selected) return;
    setFile(selected);
    const formData = new FormData();
    formData.append("file", selected);
    void submit(formData);
  }

  function handleYoutubeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;
    const formData = new FormData();
    formData.append("youtube_url", youtubeUrl.trim());
    void submit(formData);
  }

  function handlePlaySong(videoId: string) {
    const formData = new FormData();
    formData.append("youtube_url", videoId);
    void submit(formData);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">Stem Player</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Upload a song, get back vocals, drums, bass, and other — separated.
        </p>
      </div>

      <div className="w-full max-w-md flex flex-col gap-4">
        <label className="text-sm font-medium">
          Model
          <select
            className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={isUploading}
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex rounded-md border border-gray-300 dark:border-gray-700 p-1 text-sm">
          <button
            type="button"
            className={`flex-1 rounded py-1.5 transition-colors ${
              mode === "file"
                ? "bg-gray-200 dark:bg-gray-800 font-medium"
                : "text-gray-500"
            }`}
            onClick={() => setMode("file")}
            disabled={isUploading}
          >
            Upload file
          </button>
          <button
            type="button"
            className={`flex-1 rounded py-1.5 transition-colors ${
              mode === "youtube"
                ? "bg-gray-200 dark:bg-gray-800 font-medium"
                : "text-gray-500"
            }`}
            onClick={() => setMode("youtube")}
            disabled={isUploading}
          >
            YouTube URL
          </button>
        </div>

        {mode === "file" ? (
          <div
            className={`rounded-lg border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
              isDragging
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                : "border-gray-300 dark:border-gray-700"
            } ${isUploading ? "opacity-60 pointer-events-none" : ""}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <p className="text-sm">
              {isUploading
                ? "Uploading…"
                : file
                  ? file.name
                  : "Drag & drop an audio file, or click to browse"}
            </p>
          </div>
        ) : (
          <form onSubmit={handleYoutubeSubmit} className="flex flex-col gap-2">
            <input
              type="url"
              placeholder="https://www.youtube.com/watch?v=…"
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 text-sm"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              disabled={isUploading}
              required
            />
            <button
              type="submit"
              className="rounded-md bg-blue-600 text-white text-sm font-medium py-2 disabled:opacity-60"
              disabled={isUploading || !youtubeUrl.trim()}
            >
              {isUploading ? "Starting…" : "Separate"}
            </button>
          </form>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>

      {songs && songs.length > 0 && (
        <div className="w-full max-w-md flex flex-col gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Songs
          </h2>
          <ul className="flex flex-col gap-1.5">
            {songs.map((song) => {
              const videoId = extractVideoId(song.name);
              return (
                <li
                  key={song.name}
                  className="flex items-center gap-3 rounded-md border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm"
                >
                  <span className="truncate flex-1">{song.name}</span>
                  {song.has_analysis && (
                    <span className="shrink-0 text-xs text-gray-400">Analyzed</span>
                  )}
                  {videoId && (
                    <button
                      type="button"
                      onClick={() => handlePlaySong(videoId)}
                      disabled={isUploading}
                      className="shrink-0 rounded-md bg-blue-600 text-white text-xs font-medium px-2.5 py-1 disabled:opacity-60"
                    >
                      Play
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="w-full max-w-md flex flex-col gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Jobs
          </h2>
          <ul className="flex flex-col gap-1.5">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link
                  to={`/jobs/${job.id}`}
                  className="flex items-center gap-3 rounded-md border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <span className="truncate flex-1">{job.title ?? job.id}</span>
                  <StatusLabel status={job.status} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}

const STATUS_LABELS: Record<JobStatus, string> = {
  queued: "Queued",
  downloading: "Downloading",
  processing: "Processing",
  done: "Done",
  error: "Error",
};

const STATUS_COLORS: Record<JobStatus, string> = {
  queued: "text-gray-500 dark:text-gray-400",
  downloading: "text-blue-600 dark:text-blue-400",
  processing: "text-blue-600 dark:text-blue-400",
  done: "text-green-600 dark:text-green-400",
  error: "text-red-600 dark:text-red-400",
};

function StatusLabel({ status }: { status: JobStatus }) {
  return (
    <span className={`shrink-0 text-xs font-medium ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
