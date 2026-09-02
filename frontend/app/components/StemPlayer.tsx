import { useCallback, useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { STEM_NAMES } from "../types";
import Waveform from "./Waveform";

interface StemPlayerProps {
  jobId: string;
  stemPaths: Record<string, string>;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function StemPlayer({ jobId, stemPaths }: StemPlayerProps) {
  const stems = STEM_NAMES.filter((name) => stemPaths[name]);

  const playersRef = useRef<Record<string, Tone.GrainPlayer>>({});
  const seekingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  // GrainPlayer re-derives its buffer offset from the Transport's synced-start
  // offset every (re)start using: bufferOffset(T) = playbackRate * (startOffset + T),
  // where T is real seconds elapsed since that (re)start and startOffset is
  // whatever Transport.seconds was at that moment (traced from GrainPlayer.js's
  // _start/_tick). So to anchor playback at song position P, Transport.seconds
  // must be set to P / speed (not P) -- these two anchors are tracked separately
  // since they diverge by a factor of `speed`.
  const anchorPositionRef = useRef(0);
  const anchorTransportRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [muted, setMuted] = useState<Record<string, boolean>>({});
  const [cursor, setCursor] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1);

  // Create/load one Tone.GrainPlayer per stem, synced to the shared Transport.
  // GrainPlayer's playbackRate changes speed without altering pitch (granular
  // synthesis keeps them independent), so no separate pitch-compensation node
  // is needed.
  useEffect(() => {
    let cancelled = false;
    const transport = Tone.getTransport();
    transport.stop();
    transport.seconds = 0;

    setReady(false);
    setIsPlaying(false);
    setPosition(0);
    setLoadError(null);
    setSpeed(1);
    anchorPositionRef.current = 0;
    anchorTransportRef.current = 0;

    const players: Record<string, Tone.GrainPlayer> = {};
    let loadedCount = 0;

    for (const name of stems) {
      // GrainPlayer adjusts pitch and playback rate independently (granular
      // synthesis), so playbackRate alone can change speed without a separate
      // pitch-compensation node.
      const player = new Tone.GrainPlayer({
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

  // Force GrainPlayer's synced offset to (re)anchor at exactly `songPosition`:
  // Transport.seconds must be set to songPosition / speed (see the note by
  // anchorPositionRef above). Setting Transport.seconds while started makes
  // Tone internally stop+restart every synced source at that offset (this is
  // also what makes seeking-while-playing work); while paused it just
  // repositions the frozen clock.
  const resyncTransport = useCallback(
    (songPosition: number) => {
      const transportTarget = speed > 0 ? songPosition / speed : 0;
      Tone.getTransport().seconds = transportTarget;
      anchorPositionRef.current = songPosition;
      anchorTransportRef.current = transportTarget;
      setPosition(songPosition);
    },
    [speed],
  );

  const handlePause = useCallback(() => {
    const transport = Tone.getTransport();
    const finalPosition =
      anchorPositionRef.current + speed * (transport.seconds - anchorTransportRef.current);
    transport.pause();
    resyncTransport(finalPosition);
    setIsPlaying(false);
  }, [speed, resyncTransport]);

  // Poll the Transport position while playing to drive the seek bar. Song
  // position is extrapolated from the last anchor pair using the current speed
  // (see anchorPositionRef/anchorTransportRef above).
  useEffect(() => {
    if (!isPlaying) return;
    const transport = Tone.getTransport();

    function tick() {
      if (!seekingRef.current) {
        const songPosition =
          anchorPositionRef.current + speed * (transport.seconds - anchorTransportRef.current);
        if (duration > 0 && songPosition >= duration) {
          transport.pause();
          resyncTransport(0);
          setIsPlaying(false);
          return;
        }
        setPosition(songPosition);
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, duration, speed, resyncTransport]);

  const handlePlayPause = useCallback(async () => {
    await Tone.start();
    const transport = Tone.getTransport();
    if (isPlaying) {
      handlePause();
    } else {
      const target = duration > 0 && position >= duration ? 0 : position;
      resyncTransport(target);
      transport.start();
      setIsPlaying(true);
    }
  }, [isPlaying, duration, position, handlePause, resyncTransport]);

  function handleSeek(value: number) {
    resyncTransport(value);
  }

  const handlePlayFromCursor = useCallback(async () => {
    if (cursor === null) return;
    await Tone.start();
    const target = Math.min(1, Math.max(0, cursor)) * duration;
    resyncTransport(target);
    Tone.getTransport().start();
    setIsPlaying(true);
  }, [cursor, duration, resyncTransport]);

  function handleSpeedChange(newSpeed: number) {
    for (const player of Object.values(playersRef.current)) {
      player.playbackRate = newSpeed;
    }
    // Re-anchor at the current position using the NEW speed (not via
    // resyncTransport, which is still bound to the old speed from this
    // render's closure) so playback continues seamlessly from here.
    const transportTarget = newSpeed > 0 ? position / newSpeed : 0;
    Tone.getTransport().seconds = transportTarget;
    anchorPositionRef.current = position;
    anchorTransportRef.current = transportTarget;
    setSpeed(newSpeed);
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
        <button
          type="button"
          onClick={() => void handlePlayFromCursor()}
          disabled={!ready || cursor === null}
          aria-label="Play from cursor"
          title="Play from cursor"
          className="shrink-0 rounded-full w-10 h-10 flex items-center justify-center bg-amber-500 text-white disabled:opacity-50"
        >
          ▶
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
        <select
          value={speed}
          onChange={(e) => handleSpeedChange(Number(e.target.value))}
          disabled={!ready}
          aria-label="Playback speed"
          title="Playback speed (pitch preserved)"
          className="shrink-0 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent text-xs px-1.5 py-1 disabled:opacity-50"
        >
          {SPEED_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}x
            </option>
          ))}
        </select>
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
              onDoubleClick={(ratio) => setCursor(ratio)}
              cursor={cursor}
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
