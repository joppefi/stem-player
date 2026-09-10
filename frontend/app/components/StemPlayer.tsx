import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Tone from "tone";
import { STEM_NAMES } from "../types";
import { useGetSongAnalysis } from "~/api/hooks.generated";
import IconButton from "./IconButton";
import KeyboardController from "./KeyboardController";
import PlaybackSpeedSelect from "./PlaybackSpeedSelect";
import SeekBar from "./SeekBar";
import StemRow from "./StemRow";
import TimeLabel from "./TimeLabel";
import type { BeatMarker } from "./Waveform";

interface StemPlayerProps {
  songId: string;
  stemPaths: Record<string, string>;
}

const CURSOR_STEP_SECONDS = 0.1;

export default function StemPlayer({ songId, stemPaths }: StemPlayerProps) {
  const { data: analysisData } = useGetSongAnalysis(songId);

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
        url: `/api/songs/${songId}/stems/${name}`,
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
  }, [songId]);

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
    await Tone.start();
    const target =
      cursor === null ? 0 : Math.min(1, Math.max(0, cursor)) * duration;
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

  // Mirrors state that changes every animation frame during playback (position)
  // so the W/S/D handlers below can read the latest values without needing to
  // be recreated on every tick -- keeps them (and keyboardControls' identity)
  // stable, same reasoning as the comment above it.
  const latestRef = useRef({ cursor, position, duration });
  useEffect(() => {
    latestRef.current = { cursor, position, duration };
  });

  const moveCursorLeft = useCallback(() => {
    const { cursor, position, duration } = latestRef.current;
    if (duration <= 0) return;
    const base = cursor === null ? position / duration : cursor;
    setCursor(Math.max(0, base - CURSOR_STEP_SECONDS / duration));
  }, []);

  const moveCursorRight = useCallback(() => {
    const { cursor, position, duration } = latestRef.current;
    if (duration <= 0) return;
    const base = cursor === null ? position / duration : cursor;
    setCursor(Math.min(1, base + CURSOR_STEP_SECONDS / duration));
  }, []);

  const setCursorToCurrentPosition = useCallback(() => {
    const { position, duration } = latestRef.current;
    if (duration <= 0) return;
    setCursor(position / duration);
  }, []);

  // handlePlayPause itself is recreated every tick (it depends on `position`),
  // so calling it directly from keyboardControls would churn the memo below on
  // every animation frame just like the state it's built from. Route through a
  // ref to the latest version instead, called via a permanently-stable wrapper.
  const handlePlayPauseRef = useRef(handlePlayPause);
  useEffect(() => {
    handlePlayPauseRef.current = handlePlayPause;
  });
  const togglePlayPauseAtCurrentPosition = useCallback(() => {
    void handlePlayPauseRef.current();
  }, []);

  // Stable reference so KeyboardController's window listener isn't torn down
  // and re-attached on every render (position updates ~60x/sec while playing).
  const keyboardControls = useMemo(
    () => [
      {
        key: " ",
        description: "Play from cursor",
        handler: () => void handlePlayFromCursor(),
      },
      {
        key: "a",
        description: "Move cursor left",
        handler: moveCursorLeft,
      },
      {
        key: "d",
        description: "Move cursor right",
        handler: moveCursorRight,
      },
      {
        key: "s",
        description: "Set cursor to current position",
        handler: setCursorToCurrentPosition,
      },
      {
        key: "q",
        description: "Remove cursor",
        handler: () => setCursor(null),
      },
      {
        key: "Alt",
        description: "Play/pause at current position",
        handler: togglePlayPauseAtCurrentPosition,
      },
    ],
    [
      handlePlayFromCursor,
      moveCursorLeft,
      moveCursorRight,
      setCursorToCurrentPosition,
      togglePlayPauseAtCurrentPosition,
    ],
  );

  // Beat grid: one marker per beat from first_beat to the end of the song,
  // spaced by 60/bpm seconds, every 4th flagged as a measure boundary.
  const beats = useMemo<BeatMarker[]>(() => {
    const bpm = analysisData?.bpm;
    const firstBeat = analysisData?.first_beat;
    if (!bpm || firstBeat === undefined || duration <= 0) return [];

    const beatInterval = 60 / bpm;
    const markers: BeatMarker[] = [];
    let beatIndex = 0;
    for (let t = firstBeat; t < duration; t += beatInterval, beatIndex += 1) {
      markers.push({ ratio: t / duration, isMeasure: beatIndex % 4 === 0 });
    }
    return markers;
  }, [analysisData?.bpm, analysisData?.first_beat, duration]);

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
        <IconButton
          onClick={() => void handlePlayPause()}
          disabled={!ready}
          ariaLabel={isPlaying ? "Pause" : "Play"}
          color="blue"
        >
          {isPlaying ? "❚❚" : "▶"}
        </IconButton>
        <IconButton
          onClick={() => void handlePlayFromCursor()}
          disabled={!ready}
          ariaLabel="Play from cursor"
          title="Play from cursor"
          color="amber"
        >
          ❚▶
        </IconButton>
        <TimeLabel seconds={position} align="right" />
        <SeekBar
          value={position}
          max={duration || 0}
          disabled={!ready}
          onChange={handleSeek}
          onSeekStart={() => {
            seekingRef.current = true;
          }}
          onSeekEnd={() => {
            seekingRef.current = false;
          }}
        />
        <TimeLabel seconds={duration} />
        <PlaybackSpeedSelect
          value={speed}
          onChange={handleSpeedChange}
          disabled={!ready}
        />
      </div>

      {!ready && <p className="text-xs text-gray-400">Loading audio…</p>}

      <div className="flex flex-col gap-2">
        {stems.map((name) => (
          <StemRow
            key={name}
            songId={songId}
            name={name}
            muted={muted[name]}
            onToggleMute={() => toggleMute(name)}
            progress={duration > 0 ? position / duration : 0}
            onSeek={(ratio) => handleSeek(ratio * duration)}
            onDoubleClick={(ratio) => setCursor(ratio)}
            cursor={cursor}
            disabled={!ready}
            beats={beats}
          />
        ))}
      </div>

      {ready && <KeyboardController controls={keyboardControls} />}
    </div>
  );
}
