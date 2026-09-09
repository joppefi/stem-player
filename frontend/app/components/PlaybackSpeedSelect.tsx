interface PlaybackSpeedSelectProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const SPEED_OPTIONS = [0.5, 0.75, 0.8, 0.85, 0.9, 0.95, 1];

export default function PlaybackSpeedSelect({
  value,
  onChange,
  disabled,
}: PlaybackSpeedSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      disabled={disabled}
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
  );
}
