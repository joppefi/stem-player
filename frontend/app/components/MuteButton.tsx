interface MuteButtonProps {
  muted: boolean;
  onToggle: () => void;
}

export default function MuteButton({ muted, onToggle }: MuteButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={muted ? "Unmute" : "Mute"}
      className={`text-xs font-medium rounded px-2 py-1 border shrink-0 ${
        muted
          ? "border-red-400 text-red-500 bg-red-50 dark:bg-red-950/30"
          : "border-gray-300 dark:border-gray-700"
      }`}
    >
      {muted ? "🔇" : "🔈"}
    </button>
  );
}
