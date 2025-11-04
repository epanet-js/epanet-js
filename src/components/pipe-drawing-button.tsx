import * as Tooltip from "@radix-ui/react-tooltip";
import { Button, TContent, Keycap } from "./elements";
import { PipeIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import { Mode } from "src/state/jotai";
import { localizeKeybinding } from "src/infra/i18n";
import { useHotkeys } from "src/keyboard/hotkeys";
import { useDrawingMode } from "src/commands/set-drawing-mode";

export const PipeDrawingButton = ({
  hotkey,
  selected,
}: {
  hotkey: string;
  selected: boolean;
}) => {
  const translate = useTranslate();
  const setDrawingMode = useDrawingMode();

  useHotkeys(
    hotkey || "noop",
    (e) => {
      e.preventDefault();
      void setDrawingMode(Mode.DRAW_PIPE);
    },
    [setDrawingMode],
    "Pipe drawing mode",
  );

  return (
    <Tooltip.Root delayDuration={200}>
      <div className="h-10 w-8 group bn flex items-stretch py-1 focus:outline-none">
        <Tooltip.Trigger asChild>
          <Button
            variant="quiet/mode"
            role="radio"
            aria-label={translate("drawPipe")}
            aria-checked={selected}
            aria-expanded={selected ? "true" : "false"}
            onClick={() => void setDrawingMode(Mode.DRAW_PIPE)}
          >
            <PipeIcon />
          </Button>
        </Tooltip.Trigger>
      </div>
      <TContent side="bottom">
        <div className="flex gap-x-2 items-center">
          {translate("drawPipe")}
          <Keycap size="xs">{localizeKeybinding(hotkey)}</Keycap>
        </div>
      </TContent>
    </Tooltip.Root>
  );
};
