interface SeekBarProps {
  value: number;
  min?: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  /** Fired on pointer down/up, e.g. to suppress a position-tick loop while dragging. */
  onSeekStart?: () => void;
  onSeekEnd?: () => void;
}

export default function SeekBar({
  value,
  min = 0,
  max,
  disabled,
  onChange,
  onSeekStart,
  onSeekEnd,
}: SeekBarProps) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={0.01}
      value={Math.min(value, max || 0)}
      disabled={disabled}
      onPointerDown={() => onSeekStart?.()}
      onPointerUp={() => onSeekEnd?.()}
      onChange={(e) => onChange(Number(e.target.value))}
      className="flex-1 accent-blue-600"
    />
  );
}
