import { useHotkeys } from "src/keyboard/hotkeys";
import { TContent, Keycap, Button } from "./elements";
import * as Tooltip from "@radix-ui/react-tooltip";
import { localizeKeybinding } from "src/infra/i18n";

export default function MenuAction({
  selected = false,
  onClick,
  children,
  disabled = false,
  role = undefined,
  label,
  hotkey,
}: {
  selected?: boolean;
  onClick: (e?: Pick<React.MouseEvent, "shiftKey">) => void;
  children: React.ReactNode;
  disabled?: boolean;
  role?: React.HTMLAttributes<HTMLButtonElement>["role"];
  label: string;
  hotkey?: string;
}) {
  useHotkeys(
    hotkey || "noop",
    (e) => {
      e.preventDefault();
      onClick();
    },
    [onClick],
    `Menu action ${label}`,
  );

  return (
    <div className="relative">
      <Tooltip.Root>
        <div
          className={`h-10 w-8 ${
            disabled ? "opacity-50" : ""
          } group bn flex items-stretch py-1 focus:outline-none`}
        >
          <Tooltip.Trigger asChild>
            <Button
              onClick={onClick}
              variant="quiet/mode"
              role={role}
              disabled={disabled}
              aria-label={label}
              aria-checked={selected}
              aria-expanded={selected ? "true" : "false"}
            >
              {children}
            </Button>
          </Tooltip.Trigger>
        </div>

        <TContent side="bottom">
          <div className="flex gap-x-2 items-center">
            {label}
            {hotkey ? (
              <Keycap size="xs">{localizeKeybinding(hotkey)}</Keycap>
            ) : null}
          </div>
        </TContent>
      </Tooltip.Root>
    </div>
  );
}
