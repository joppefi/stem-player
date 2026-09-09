interface TimeLabelProps {
  seconds: number;
  align?: "left" | "right";
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function TimeLabel({ seconds, align = "left" }: TimeLabelProps) {
  return (
    <span
      className={`text-xs tabular-nums text-gray-500 dark:text-gray-400 w-10 ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {formatTime(seconds)}
    </span>
  );
}
