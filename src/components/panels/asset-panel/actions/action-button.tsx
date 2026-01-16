import * as Tooltip from "@radix-ui/react-tooltip";
import {
  Button,
  TContent,
  StyledTooltipArrow,
  Keycap,
  B3Variant,
} from "src/components/elements";
import { localizeKeybinding } from "src/infra/i18n";

export interface Action {
  onSelect: (event?: Event) => Promise<void>;
  icon: React.ReactNode;
  label: string;
  applicable: boolean;
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
    <Tooltip.Root>
      <Tooltip.Trigger
        onClick={(evt) => !disabled && onSelect(evt as unknown as Event)}
        asChild
      >
        <Button
          variant={selected ? "quiet/mode" : variant}
          aria-expanded={selected ? "true" : "false"}
          disabled={disabled}
          className={disabled ? "cursor-not-allowed" : ""}
        >
          {icon}
        </Button>
      </Tooltip.Trigger>
      <TContent side="bottom">
        <StyledTooltipArrow />
        <div className="flex gap-x-2 items-center whitespace-nowrap">
          {label}
          {shortcut ? (
            <Keycap size="xs">{localizeKeybinding(shortcut)}</Keycap>
          ) : null}
        </div>
      </TContent>
    </Tooltip.Root>
  );
}
