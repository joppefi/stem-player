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
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState<string>(MODELS[0].value);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(selected: File) {
    setError(null);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selected);
      const response = await fetch(`/api/separate?model=${encodeURIComponent(model)}`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? `Upload failed (${response.status})`);
      }
      const { job_id } = await response.json();
      navigate(`/jobs/${job_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setIsUploading(false);
    }
  }

  function handleFiles(files: FileList | null) {
    const selected = files?.[0];
    if (!selected) return;
    setFile(selected);
    void submit(selected);
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

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </main>
  );
}
