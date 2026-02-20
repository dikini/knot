import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import "./IconButton.css";

// SPEC: COMP-ICON-CHROME-001 FR-5
interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: LucideIcon;
  label: string;
  showLabel?: boolean;
  active?: boolean;
}

export function IconButton({
  icon: Icon,
  label,
  showLabel = false,
  active = false,
  className,
  ...buttonProps
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? "icon-button--active" : ""} ${className ?? ""}`.trim()}
      aria-label={label}
      title={label}
      {...buttonProps}
    >
      <Icon className="icon-button__icon" size={18} strokeWidth={1.75} aria-hidden="true" />
      {showLabel && <span className="icon-button__label">{label}</span>}
    </button>
  );
}
