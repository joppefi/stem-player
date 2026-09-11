import { useState } from "react";
import * as Tone from "tone";
import { Label } from "./Field";

// Tone.js routes every stem's output through the same shared Destination
// (see StemPlayer.tsx), so this can drive it directly without needing to
// know whether a song is currently loaded.
function currentVolumePercent(): number {
  const db = Tone.getDestination().volume.value;
  return Math.round(Tone.dbToGain(db) * 100);
}

export default function VolumeControl() {
  const [percent, setPercent] = useState(currentVolumePercent);

  function handleChange(value: number) {
    setPercent(value);
    Tone.getDestination().volume.value =
      value === 0 ? -Infinity : Tone.gainToDb(value / 100);
  }

  return (
    <div>
      <Label>Volume</Label>
      <input
        type="range"
        min={0}
        max={100}
        value={percent}
        onChange={(e) => handleChange(Number(e.target.value))}
        aria-label="Volume"
        className="w-24 accent-blue-600"
      />
    </div>
  );
}
