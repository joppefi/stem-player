import { useCallback, useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { STEM_NAMES } from "../types";
import Waveform from "./Waveform";

interface StemPlayerProps {
  jobId: string;
  stemPaths: Record<string, string>;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function StemPlayer({ jobId, stemPaths }: StemPlayerProps) {
  const stems = STEM_NAMES.filter((name) => stemPaths[name]);

  const playersRef = useRef<Record<string, Tone.Player>>({});
  const seekingRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [muted, setMuted] = useState<Record<string, boolean>>({});

  // Create/load one Tone.Player per stem, synced to the shared Transport.
  useEffect(() => {
    let cancelled = false;
    const transport = Tone.getTransport();
    transport.stop();
    transport.seconds = 0;

    setReady(false);
    setIsPlaying(false);
    setPosition(0);
    setLoadError(null);

    const players: Record<string, Tone.Player> = {};
    let loadedCount = 0;

    for (const name of stems) {
      const player = new Tone.Player({
        url: `/api/jobs/${jobId}/stems/${name}`,
        onload: () => {
          if (cancelled) return;
          loadedCount += 1;
          if (loadedCount === stems.length) {
            const longest = Math.max(
              ...Object.values(players).map((p) => p.buffer.duration),
            );
            setDuration(longest);
            setReady(true);
          }
        },
        onerror: (err) => {
          if (!cancelled) setLoadError(err.message || "Failed to load audio");
        },
      }).toDestination();
      player.sync().start(0);
      players[name] = player;
    }

    playersRef.current = players;
    setMuted(Object.fromEntries(stems.map((name) => [name, false])));

    return () => {
      cancelled = true;
      transport.stop();
      for (const player of Object.values(players)) {
        player.unsync();
        player.dispose();
      }
      playersRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const handlePause = useCallback(() => {
    Tone.getTransport().pause();
    setIsPlaying(false);
  }, []);

  // Poll the Transport position while playing to drive the seek bar.
  useEffect(() => {
    if (!isPlaying) return;
    const transport = Tone.getTransport();

    function tick() {
      if (!seekingRef.current) {
        const pos = transport.seconds;
        if (duration > 0 && pos >= duration) {
          handlePause();
          transport.seconds = 0;
          setPosition(0);
          return;
        }
        setPosition(pos);
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, duration, handlePause]);

  const handlePlayPause = useCallback(async () => {
    await Tone.start();
    const transport = Tone.getTransport();
    if (isPlaying) {
      handlePause();
    } else {
      if (duration > 0 && transport.seconds >= duration) {
        transport.seconds = 0;
        setPosition(0);
      }
      transport.start();
      setIsPlaying(true);
    }
  }, [isPlaying, duration, handlePause]);

  function handleSeek(value: number) {
    Tone.getTransport().seconds = value;
    setPosition(value);
  }

  function toggleMute(name: string) {
    const player = playersRef.current[name];
    if (!player) return;
    const next = !player.mute;
    player.mute = next;
    setMuted((prev) => ({ ...prev, [name]: next }));
  }

  if (loadError) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Failed to load audio: {loadError}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handlePlayPause()}
          disabled={!ready}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="shrink-0 rounded-full w-10 h-10 flex items-center justify-center bg-blue-600 text-white disabled:opacity-50"
        >
          {isPlaying ? "❚❚" : "▶"}
        </button>
        <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400 w-10 text-right">
          {formatTime(position)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={Math.min(position, duration || 0)}
          disabled={!ready}
          onPointerDown={() => {
            seekingRef.current = true;
          }}
          onPointerUp={() => {
            seekingRef.current = false;
          }}
          onChange={(e) => handleSeek(Number(e.target.value))}
          className="flex-1 accent-blue-600"
        />
        <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400 w-10">
          {formatTime(duration)}
        </span>
      </div>

      {!ready && <p className="text-xs text-gray-400">Loading audio…</p>}

      <div className="flex flex-col gap-2">
        {stems.map((name) => (
          <div key={name} className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => toggleMute(name)}
              className={`text-xs font-medium rounded px-2 py-1 border w-16 shrink-0 ${
                muted[name]
                  ? "border-red-400 text-red-500 bg-red-50 dark:bg-red-950/30"
                  : "border-gray-300 dark:border-gray-700"
              }`}
            >
              {muted[name] ? "Unmute" : "Mute"}
            </button>
            <span className="text-sm capitalize w-14 shrink-0">{name}</span>
            <Waveform
              jobId={jobId}
              stemName={name}
              progress={duration > 0 ? position / duration : 0}
              onSeek={(ratio) => handleSeek(ratio * duration)}
              disabled={!ready}
            />
            <a
              href={`/api/jobs/${jobId}/stems/${name}`}
              download
              className="shrink-0 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Download
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
