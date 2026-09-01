export type JobStatus = "queued" | "downloading" | "processing" | "done" | "error";

export interface Job {
  id: string;
  status: JobStatus;
  progress: number;
  stem_paths: Record<string, string> | null;
  error: string | null;
}

export const STEM_NAMES = ["vocals", "drums", "bass", "other"] as const;

export const MODELS = [
  { value: "htdemucs", label: "htdemucs (fast)" },
  { value: "htdemucs_ft", label: "htdemucs_ft (higher quality, slower)" },
] as const;
