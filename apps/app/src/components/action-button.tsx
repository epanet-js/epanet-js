import clsx from "clsx";
import { Tooltip } from "@epanet-js/ui-kit";
import { Button, Keycap, B3Variant } from "src/components/elements";
import { localizeKeybinding } from "src/infra/i18n";

export interface Action {
  onSelect: (event?: Event) => Promise<void>;
  icon: React.ReactNode;
  label: string;
  applicable: boolean;
  priority?: number;
  variant?: B3Variant;
  shortcut?: string;
  selected?: boolean;
  disabled?: boolean;
}

export function ActionButton({ action }: { action: Action }) {
  const {
    icon,
    label,
    onSelect,
    variant = "quiet",
    shortcut,
    selected = false,
    disabled = false,
  } = action;

  return (
    <Tooltip
      delayDuration={700}
      content={
        <div className="flex gap-x-2 items-center whitespace-nowrap">
          {label}
          {shortcut ? (
            <Keycap size="xs">{localizeKeybinding(shortcut)}</Keycap>
          ) : null}
        </div>
      }
    >
      <Button
        variant={selected ? "quiet/mode" : variant}
        aria-expanded={selected ? "true" : "false"}
        disabled={disabled}
        aria-label={label}
        className={clsx("h-8", disabled ? "cursor-not-allowed" : "")}
        onClick={(evt) => !disabled && onSelect(evt as unknown as Event)}
      >
        {icon}
      </Button>
    </Tooltip>
  );
}
