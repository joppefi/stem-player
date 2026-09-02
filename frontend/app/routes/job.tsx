import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import type { Route } from "./+types/job";
import StemPlayer from "../components/StemPlayer";
import type { Job } from "../types";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Separating… — Stem Player" }];
}

export default function JobPage() {
  const { jobId } = useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [connectionError, setConnectionError] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    let pollHandle: ReturnType<typeof setInterval> | null = null;
    const socket = new WebSocket(
      `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws/jobs/${jobId}`,
    );

    function startPolling() {
      if (pollHandle) return;
      setConnectionError(true);
      pollHandle = setInterval(async () => {
        try {
          const res = await fetch(`/api/jobs/${jobId}`);
          if (!res.ok) return;
          const data: Job = await res.json();
          if (cancelled) return;
          setJob(data);
          if (data.status === "done" || data.status === "error") {
            if (pollHandle) clearInterval(pollHandle);
          }
        } catch {
          // keep polling
        }
      }, 2000);
    }

    socket.onmessage = (event) => {
      if (cancelled) return;
      const data: Job = JSON.parse(event.data);
      setJob(data);
    };
    socket.onerror = () => {
      startPolling();
    };
    socket.onclose = (event) => {
      if (!cancelled && event.code !== 1000) {
        startPolling();
      }
    };

    return () => {
      cancelled = true;
      socket.close();
      if (pollHandle) clearInterval(pollHandle);
    };
  }, [jobId]);

  if (!jobId) {
    return <ErrorScreen message="No job id given." />;
  }

  if (!job) {
    return (
      <Centered>
        <p className="text-gray-500 dark:text-gray-400">Connecting…</p>
      </Centered>
    );
  }

  if (job.status === "error") {
    return <ErrorScreen message={job.error ?? "Separation failed."} />;
  }

  if (job.status === "done" && job.stem_paths) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Stems ready</h1>
          <Link to="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            Separate another song
          </Link>
        </div>
        <div className="w-full max-w-xl">
          <StemPlayer jobId={jobId} stemPaths={job.stem_paths} />
        </div>
      </main>
    );
  }

  const percent = Math.round((job.progress ?? 0) * 100);
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">
        {job.status === "queued"
          ? "Queued…"
          : job.status === "downloading"
            ? "Downloading…"
            : "Separating…"}
      </h1>
      <div className="w-full max-w-md">
        <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">{percent}%</p>
      </div>
      {connectionError && (
        <p className="text-xs text-gray-400">Live updates unavailable — polling for status…</p>
      )}
    </main>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <Centered>
      <div className="text-center flex flex-col gap-3">
        <h1 className="text-xl font-semibold text-red-600 dark:text-red-400">
          Separation failed
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
        <Link to="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          Try again
        </Link>
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen flex items-center justify-center p-6">{children}</main>;
}
