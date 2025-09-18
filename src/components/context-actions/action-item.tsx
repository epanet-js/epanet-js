import * as Tooltip from "@radix-ui/react-tooltip";
import {
  CMItem,
  StyledItem,
  TContent,
  StyledTooltipArrow,
  Button,
  B3Variant,
  Keycap,
} from "src/components/elements";
import { localizeKeybinding } from "src/infra/i18n";

export interface Action {
  onSelect: (event?: Event) => Promise<void>;
  icon: React.ReactNode;
  label: string;
  variant?: B3Variant;
  applicable: boolean;
  shortcut?: string;
  selected?: boolean;
}

export interface ActionProps {
  action: Action;
  as: "dropdown-item" | "context-item" | "root";
}

export function ActionItem({
  action: {
    icon,
    label,
    onSelect,
    variant = "quiet",
    shortcut,
    selected = false,
  },
  as,
  ...rest
}: {
  action: Action;
  as: ActionProps["as"];
} & React.ComponentProps<typeof CMItem>) {
  return as === "dropdown-item" ? (
    <StyledItem onSelect={onSelect} {...rest} variant={variant}>
      {icon} {label}
    </StyledItem>
  ) : as === "context-item" ? (
    <CMItem onSelect={onSelect} {...rest} variant={variant}>
      {icon} {label}
    </CMItem>
  ) : (
    <Tooltip.Root>
      <div
        className="h-10 w-8 py-1
          group bn
          flex items-stretch justify-center focus:outline-none"
      >
        <Tooltip.Trigger
          onClick={(evt) => onSelect(evt as unknown as Event)}
          asChild
        >
          <Button
            variant={selected ? "quiet/mode" : variant}
            aria-expanded={selected ? "true" : "false"}
          >
            {icon}
          </Button>
        </Tooltip.Trigger>
      </div>
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
