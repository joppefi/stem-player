import React, { useEffect } from "react";

type KeyboardControl = {
  /** Must match KeyboardEvent.key exactly, e.g. " " for space, "ArrowLeft", "m". */
  key: string;
  title?: string;
  description: string;
  handler: () => void;
};

type KeyboardControllerProps = {
  controls: KeyboardControl[];
  title?: string;
};

const KEY_LABELS: Record<string, string> = {
  " ": "Space",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Escape: "Esc",
};

function formatKeyLabel(key: string): string {
  return KEY_LABELS[key]?.toUpperCase() ?? key.toUpperCase();
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

function KeyboardController({ controls, title }: KeyboardControllerProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Don't hijack typing in a text field, URL input, etc.
      if (isEditableTarget(event.target)) return;

      const control = controls.find(
        (c) => c.key.toLowerCase() === event.key.toLowerCase(),
      );
      if (!control) return;

      // Also suppresses the browser's native Space/Enter-activates-focused-button
      // behavior for this key, so a focused button doesn't double-fire alongside
      // the handler below.
      event.preventDefault();
      control.handler();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [controls]);

  if (controls.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {title && (
        <h3 className="text-xs font-medium uppercase tracking-wide text-gray-400">
          {title}
        </h3>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {controls.map((control) => (
          <React.Fragment key={control.key}>
            {control.title && (
              <h3 className="text-xs font-medium uppercase tracking-wide text-gray-400 w-full">
                {control.title}
              </h3>
            )}
            <div className="flex items-center gap-1.5">
              <kbd className="rounded border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 font-mono text-[11px] leading-none text-gray-600 dark:text-gray-300">
                {formatKeyLabel(control.key)}
              </kbd>
              <span className="text-xs text-gray-400">
                {control.description}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export default KeyboardController;
