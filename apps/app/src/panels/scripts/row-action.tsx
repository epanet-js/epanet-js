export const RowAction = ({
  label,
  onActivate,
  disabled = false,
  disabledReason,
  children,
}: {
  label: string;
  onActivate: () => void;
  disabled?: boolean;
  disabledReason?: string;
  children: React.ReactNode;
}) => (
  <span
    role="button"
    tabIndex={disabled ? -1 : 0}
    aria-label={label}
    aria-disabled={disabled || undefined}
    title={disabled ? (disabledReason ?? label) : label}
    onPointerDown={(e) => e.stopPropagation()}
    onClick={(e) => {
      e.stopPropagation();
      if (disabled) return;
      onActivate();
    }}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        if (disabled) return;
        onActivate();
      }
    }}
    className={`inline-flex items-center justify-center rounded p-1
      focus:outline-hidden focus-visible:ring-1 focus-visible:ring-accent ${
        disabled
          ? "text-disabled cursor-not-allowed"
          : "text-subtle hover:text-default"
      }`}
  >
    {children}
  </span>
);
