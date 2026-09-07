import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import type { Route } from "./+types/job";
import StemPlayer from "../components/StemPlayer";
import type { Job } from "../types";
import SongDetails from "~/components/SongDetails";

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

    function stopAll() {
      if (pollHandle) {
        clearInterval(pollHandle);
        pollHandle = null;
      }
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close(1000);
      }
    }

    function applyUpdate(data: Job) {
      if (cancelled) return;
      setJob(data);
      // Once separation is finished (or failed), the player has everything it
      // needs — stop polling/WS traffic instead of continuing to hit the backend.
      if (data.status === "done" || data.status === "error") {
        stopAll();
      }
    }

    function startPolling() {
      if (pollHandle) return;
      setConnectionError(true);
      pollHandle = setInterval(async () => {
        try {
          const res = await fetch(`/api/jobs/${jobId}`);
          if (!res.ok) return;
          applyUpdate(await res.json());
        } catch {
          // keep polling
        }
      }, 2000);
    }

    socket.onmessage = (event) => {
      applyUpdate(JSON.parse(event.data));
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
      stopAll();
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
          {job.title && (
            <h1 className="text-2xl font-semibold break-words max-w-xl">
              {job.title}
            </h1>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Stems ready
          </p>
          <Link
            to="/"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Separate another song
          </Link>
        </div>
        <div className="w-full max-w-xl">
          <SongDetails jobId={jobId} />
          <StemPlayer jobId={jobId} stemPaths={job.stem_paths} />
        </div>
      </main>
    );
  }

  const percent = Math.round((job.progress ?? 0) * 100);
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        {job.title && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1 break-words max-w-md">
            {job.title}
          </p>
        )}
        <h1 className="text-2xl font-semibold">
          {job.status === "queued"
            ? "Queued…"
            : job.status === "downloading"
              ? "Downloading…"
              : "Separating…"}
        </h1>
      </div>
      <div className="w-full max-w-md">
        <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
          {percent}%
        </p>
      </div>
      {connectionError && (
        <p className="text-xs text-gray-400">
          Live updates unavailable — polling for status…
        </p>
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
        <Link
          to="/"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Try again
        </Link>
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      {children}
    </main>
  );
}
