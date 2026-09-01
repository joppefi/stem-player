import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/home";
import { MODELS } from "../types";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Stem Player" },
    { name: "description", content: "Split a song into vocals, drums, bass, and other." },
  ];
}

export default function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"file" | "youtube">("file");
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [model, setModel] = useState<string>(MODELS[0].value);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(formData: FormData) {
    setError(null);
    setIsUploading(true);
    try {
      const response = await fetch(`/api/separate?model=${encodeURIComponent(model)}`, {
        method: "POST",
        body: formData,
      });
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
              mode === "file" ? "bg-gray-200 dark:bg-gray-800 font-medium" : "text-gray-500"
            }`}
            onClick={() => setMode("file")}
            disabled={isUploading}
          >
            Upload file
          </button>
          <button
            type="button"
            className={`flex-1 rounded py-1.5 transition-colors ${
              mode === "youtube" ? "bg-gray-200 dark:bg-gray-800 font-medium" : "text-gray-500"
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

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </main>
  );
}
