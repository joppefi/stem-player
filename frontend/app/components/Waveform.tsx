import { useRef } from "react";

interface WaveformProps {
  jobId: string;
  stemName: string;
  progress: number; // 0..1
  onSeek: (ratio: number) => void;
  disabled?: boolean;
}

const IMAGE_WIDTH = 600;
const IMAGE_HEIGHT = 64;

export default function Waveform({ jobId, stemName, progress, onSeek, disabled }: WaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const src = `/api/jobs/${jobId}/stems/${stemName}/waveform?width=${IMAGE_WIDTH}&height=${IMAGE_HEIGHT}`;
  const clampedProgress = Math.min(1, Math.max(0, progress || 0));

  function seekFromPointer(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onSeek(ratio);
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex-1 h-16 rounded overflow-hidden bg-gray-100 dark:bg-gray-900 ${
        disabled ? "cursor-not-allowed" : "cursor-pointer"
      }`}
      onPointerDown={(e) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        seekFromPointer(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons !== 1) return;
        seekFromPointer(e);
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
        className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
        style={{ clipPath: `inset(0 ${(1 - clampedProgress) * 100}% 0 0)` }}
      />
    </div>
  );
}
