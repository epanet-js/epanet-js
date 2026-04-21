import { useCallback, useState } from "react";
import * as DD from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useAtom, useAtomValue } from "jotai";

import { Button, DDContent, TContent } from "src/components/elements";
import { useDrawingMode } from "src/commands/set-drawing-mode";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { lastDrawingModeAtom, Mode, MODE_INFO, modeAtom } from "src/state/mode";
import { DRAWING_MODE_OPTIONS } from "./modes";

export const DrawingToolDropdown = ({
  disabled = false,
}: {
  disabled?: boolean;
}) => {
  const translate = useTranslate();
  const setDrawingMode = useDrawingMode();
  const userTracking = useUserTracking();
  const { mode: currentMode } = useAtomValue(modeAtom);
  const [lastDrawingMode, setLastDrawingMode] = useAtom(lastDrawingModeAtom);
  const [isOpen, setIsOpen] = useState(false);

  const activeOption =
    DRAWING_MODE_OPTIONS.find((option) => option.mode === currentMode) ?? null;
  const displayedOption =
    activeOption ??
    DRAWING_MODE_OPTIONS.find((option) => option.mode === lastDrawingMode) ??
    DRAWING_MODE_OPTIONS[0];
  const DisplayedIcon = displayedOption.Icon;
  const isDrawingActive = activeOption !== null;

  const selectMode = useCallback(
    (mode: Mode) => {
      setLastDrawingMode(mode);
      userTracking.capture({
        name: "drawingMode.enabled",
        source: "toolbar",
        type: MODE_INFO[mode].name,
      });
      void setDrawingMode(mode);
      setIsOpen(false);
    },
    [setLastDrawingMode, userTracking, setDrawingMode],
  );

  return (
    <div className="relative">
      <Tooltip.Root delayDuration={200}>
        <div className="h-10 w-8 group bn flex items-stretch py-1 focus:outline-none">
          <DD.Root open={isOpen} onOpenChange={setIsOpen}>
            <Tooltip.Trigger asChild>
              <DD.Trigger asChild>
                <Button
                  variant="quiet/mode"
                  className="relative"
                  disabled={disabled}
                  aria-label={translate("drawingTools")}
                  aria-checked={isDrawingActive}
                  aria-expanded={isOpen || isDrawingActive ? "true" : "false"}
                >
                  <DisplayedIcon />
                  <span
                    className="absolute bottom-1 right-1 border-l-[5px] border-l-transparent border-b-[5px] border-b-gray-400 aria-expanded:border-b-white"
                    aria-expanded={isOpen || isDrawingActive ? "true" : "false"}
                    aria-hidden="true"
                  />
                </Button>
              </DD.Trigger>
            </Tooltip.Trigger>
            <DD.Portal>
              <DDContent
                align="start"
                side="bottom"
                className="flex flex-row items-center gap-x-1 px-1"
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
                {DRAWING_MODE_OPTIONS.map(({ mode, Icon }) => (
                  <DrawingModeItem
                    key={mode}
                    mode={mode}
                    Icon={Icon}
                    selected={currentMode === mode}
                    onSelect={selectMode}
                  />
                ))}
              </DDContent>
            </DD.Portal>
          </DD.Root>
        </div>
        <TContent side="bottom">{translate("drawingTools")}</TContent>
      </Tooltip.Root>
    </div>
  );
};

const DrawingModeItem = ({
  mode,
  Icon,
  selected,
  onSelect,
}: {
  mode: Mode;
  Icon: () => JSX.Element;
  selected: boolean;
  onSelect: (mode: Mode) => void;
}) => {
  const translate = useTranslate();
  const label = translate(MODE_INFO[mode].name);

  return (
    <Tooltip.Root delayDuration={200}>
      <Tooltip.Trigger asChild>
        <DD.Item
          asChild
          onSelect={(event) => {
            event.preventDefault();
            onSelect(mode);
          }}
        >
          <Button
            variant="quiet/mode"
            role="radio"
            aria-label={label}
            aria-checked={selected}
            aria-expanded={selected ? "true" : "false"}
          >
            <Icon />
          </Button>
        </DD.Item>
      </Tooltip.Trigger>
      <TContent side="bottom">{label}</TContent>
    </Tooltip.Root>
  );
};
