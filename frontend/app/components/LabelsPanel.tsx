import { useState } from "react";
import { createLabel, deleteLabel, type Label } from "~/api/labels";
import TimeLabel from "./TimeLabel";

interface LabelsPanelProps {
  songId: string;
  labels: Label[];
  loopStart: number | null;
  loopEnd: number | null;
  onSelectLabel: (label: Label) => void;
  onLabelsChanged: () => void;
}

export default function LabelsPanel({
  songId,
  labels,
  loopStart,
  loopEnd,
  onSelectLabel,
  onLabelsChanged,
}: LabelsPanelProps) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAdd = loopStart !== null && loopEnd !== null && name.trim() !== "";

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (loopStart === null || loopEnd === null || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createLabel(songId, { name: name.trim(), start: loopStart, end: loopEnd });
      setName("");
      onLabelsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add label");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(labelId: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteLabel(songId, labelId);
      onLabelsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete label");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-gray-400">
        Labels
      </h3>

      {labels.length > 0 && (
        <ul className="flex flex-col gap-1">
          {labels.map((label) => (
            <li
              key={label.id}
              className="flex items-center gap-2 text-sm rounded border border-gray-200 dark:border-gray-800 px-2 py-1"
            >
              <button
                type="button"
                onClick={() => onSelectLabel(label)}
                className="flex-1 flex items-center gap-2 text-left hover:underline"
              >
                <span className="truncate">{label.name}</span>
                <TimeLabel seconds={label.start} />
                <span className="text-gray-400">–</span>
                <TimeLabel seconds={label.end} />
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(label.id)}
                disabled={busy}
                aria-label={`Delete label ${label.name}`}
                className="text-xs text-red-500 hover:text-red-600 disabled:opacity-50 shrink-0"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={(e) => void handleAdd(e)} className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={
            loopStart === null || loopEnd === null
              ? "Set a loop first to label it"
              : "Label name (e.g. Guitar solo)"
          }
          disabled={loopStart === null || loopEnd === null}
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent text-sm px-2 py-1 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canAdd || busy}
          className="rounded-md bg-blue-600 text-white text-xs font-medium px-3 py-1.5 disabled:opacity-50"
        >
          Add label
        </button>
      </form>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
