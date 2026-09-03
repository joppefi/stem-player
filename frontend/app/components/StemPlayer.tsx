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

  const playersRef = useRef<Record<string, Tone.Player>>({});
  const pitchShiftsRef = useRef<Record<string, Tone.PitchShift>>({});
  const seekingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  // Tone's sync mechanism re-anchors a synced Player's buffer offset to
  // Transport.seconds *verbatim* every time the transport (re)starts (including
  // a seek during playback, which internally does a stop+start). Between
  // anchor points, the buffer advances at `speed` per real second while
  // Transport.seconds itself always advances at 1x real time -- so "song
  // position" has to be derived from the last anchor, not read directly off
  // Transport.seconds, whenever speed !== 1.
  const anchorRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [muted, setMuted] = useState<Record<string, boolean>>({});
  const [cursor, setCursor] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1);

  // Create/load one Tone.Player per stem, synced to the shared Transport.
  // Each player routes through its own PitchShift node so playback speed can
  // change (via player.playbackRate) without altering pitch.
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
    anchorRef.current = 0;

    const players: Record<string, Tone.Player> = {};
    const pitchShifts: Record<string, Tone.PitchShift> = {};
    let loadedCount = 0;

    for (const name of stems) {
      const pitchShift = new Tone.PitchShift().toDestination();
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
      }).connect(pitchShift);
      player.sync().start(0);
      players[name] = player;
      pitchShifts[name] = pitchShift;
    }

    playersRef.current = players;
    pitchShiftsRef.current = pitchShifts;
    setMuted(Object.fromEntries(stems.map((name) => [name, false])));

    return () => {
      cancelled = true;
      transport.stop();
      for (const player of Object.values(players)) {
        player.unsync();
        player.dispose();
      }
      for (const pitchShift of Object.values(pitchShifts)) {
        pitchShift.dispose();
      }
      playersRef.current = {};
      pitchShiftsRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // Force Tone's synced players to (re)anchor at exactly `songPosition`: setting
  // Transport.seconds while started makes Tone internally stop+restart every
  // synced source at that offset (this is also what makes seeking-while-playing
  // work); while paused it just repositions the frozen clock. Either way, the
  // buffer offset used on the next start is Transport.seconds verbatim, so the
  // anchor and Transport.seconds must always be set to the same value together.
  function resyncTransport(songPosition: number) {
    Tone.getTransport().seconds = songPosition;
    anchorRef.current = songPosition;
    setPosition(songPosition);
  }

  const handlePause = useCallback(() => {
    const transport = Tone.getTransport();
    const anchor = anchorRef.current;
    const finalPosition = anchor + speed * (transport.seconds - anchor);
    transport.pause();
    anchorRef.current = finalPosition;
    transport.seconds = finalPosition;
    setPosition(finalPosition);
    setIsPlaying(false);
  }, [speed]);

  // Poll the Transport position while playing to drive the seek bar. Since the
  // buffer only matches Transport.seconds exactly at the last anchor point,
  // song position has to be extrapolated from there using the current speed.
  useEffect(() => {
    if (!isPlaying) return;
    const transport = Tone.getTransport();

    function tick() {
      if (!seekingRef.current) {
        const anchor = anchorRef.current;
        const songPosition = anchor + speed * (transport.seconds - anchor);
        if (duration > 0 && songPosition >= duration) {
          transport.pause();
          anchorRef.current = 0;
          transport.seconds = 0;
          setPosition(0);
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
  }, [isPlaying, duration, speed]);

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
  }, [isPlaying, duration, position, handlePause]);

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
  }, [cursor, duration]);

  function handleSpeedChange(newSpeed: number) {
    for (const player of Object.values(playersRef.current)) {
      player.playbackRate = newSpeed;
    }
    // Cancel the pitch shift that changing playbackRate introduces, so the
    // song plays faster/slower without sounding higher/lower.
    const semitones = -12 * Math.log2(newSpeed);
    for (const pitchShift of Object.values(pitchShiftsRef.current)) {
      pitchShift.pitch = semitones;
    }
    // Re-anchor at the current position so playback (if running) continues
    // seamlessly from here, now advancing at the new rate.
    resyncTransport(position);
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
