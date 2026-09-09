import type { ReactNode } from "react";

interface IconButtonProps {
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
  title?: string;
  color?: "blue" | "amber";
  children: ReactNode;
}

const COLOR_CLASSES: Record<"blue" | "amber", string> = {
  blue: "bg-blue-600",
  amber: "bg-amber-500",
};

export default function IconButton({
  onClick,
  disabled,
  ariaLabel,
  title,
  color = "blue",
  children,
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      className={`shrink-0 rounded-full w-10 h-10 flex items-center justify-center text-white disabled:opacity-50 ${COLOR_CLASSES[color]}`}
    >
      {children}
    </button>
  );
}
