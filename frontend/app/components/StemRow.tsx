import MuteButton from "./MuteButton";
import Waveform from "./Waveform";

interface StemRowProps {
  songId: string;
  name: string;
  muted: boolean;
  onToggleMute: () => void;
  progress: number;
  onSeek: (ratio: number) => void;
  onDoubleClick: (ratio: number) => void;
  cursor: number | null;
  disabled: boolean;
}

export default function StemRow({
  songId,
  name,
  muted,
  onToggleMute,
  progress,
  onSeek,
  onDoubleClick,
  cursor,
  disabled,
}: StemRowProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <MuteButton muted={muted} onToggle={onToggleMute} />
        <span className="text-sm capitalize w-14 shrink-0">{name}</span>
      </div>
      <div className="flex items-center gap-3">
        <Waveform
          songId={songId}
          stemName={name}
          progress={progress}
          onSeek={onSeek}
          onDoubleClick={onDoubleClick}
          cursor={cursor}
          disabled={disabled}
          muted={muted}
        />
      </div>
    </div>
  );
}
