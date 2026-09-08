import { useRef } from "react";

interface WaveformProps {
  songId: string;
  stemName: string;
  progress: number; // 0..1
  onSeek: (ratio: number) => void;
  onDoubleClick?: (ratio: number) => void;
  cursor?: number | null; // 0..1, marker position independent of playback progress
  disabled?: boolean;
  muted?: boolean;
}

const IMAGE_WIDTH = 600;
const IMAGE_HEIGHT = 64;

export default function Waveform({
  songId,
  stemName,
  progress,
  onSeek,
  onDoubleClick,
  cursor,
  disabled,
  muted,
}: WaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const src = `/api/songs/${songId}/stems/${stemName}/waveform?width=${IMAGE_WIDTH}&height=${IMAGE_HEIGHT}`;
  const clampedProgress = Math.min(1, Math.max(0, progress || 0));

  function ratioFromClientX(clientX: number): number | null {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }

  function seekFromPointer(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    const ratio = ratioFromClientX(e.clientX);
    if (ratio !== null) onSeek(ratio);
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex-1 h-16 rounded overflow-hidden border border-gray-300 bg-gray-100 dark:bg-gray-900 ${
        disabled ? "cursor-not-allowed" : "cursor-pointer"
      }
      ${muted ? "bg-red-100 border-red-500" : ""}`}
      onPointerDown={(e) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        seekFromPointer(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons !== 1) return;
        seekFromPointer(e);
      }}
      onDoubleClick={(e) => {
        if (disabled || !onDoubleClick) return;
        const ratio = ratioFromClientX(e.clientX);
        if (ratio !== null) onDoubleClick(ratio);
      }}
    >
      {/* Upcoming portion: dimmed */}
      <img
        src={src}
        alt=""
        draggable={false}
        className="absolute inset-0 w-full h-full object-fill opacity-40 grayscale pointer-events-none select-none"
      />
      {/* Already-played portion: full color, clipped to progress */}
      <img
        src={src}
        alt=""
        draggable={false}
        className={`absolute inset-0 w-full h-full object-fill pointer-events-none select-none ${muted ? "grayscale" : ""}`}
        style={{ clipPath: `inset(0 ${(1 - clampedProgress) * 100}% 0 0)` }}
      />
      {/* Cursor marker: independent of playback progress (e.g. set via double-click) */}
      {cursor !== null && cursor !== undefined && (
        <div
          className="absolute inset-y-0 w-0.5 bg-amber-500 pointer-events-none"
          style={{ left: `${Math.min(1, Math.max(0, cursor)) * 100}%` }}
        />
      )}
    </div>
  );
}
