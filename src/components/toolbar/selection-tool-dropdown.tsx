import React from "react";
import * as DD from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";

import {
  ChevronDownIcon,
  RectangularSelectionIcon,
  PolygonalSelectionIcon,
  FreeHandSelectionIcon,
} from "src/icons";
import { useDrawingMode } from "src/commands/set-drawing-mode";
import { Mode } from "src/state/mode";
import { useAtomValue } from "jotai";
import { modeAtom } from "src/state/jotai";
import { Button, DDContent, Keycap, StyledItem, TContent } from "../elements";
import { useTranslate } from "src/hooks/use-translate";
import { localizeKeybinding } from "src/infra/i18n";
import { selectionModeShortcut } from "src/commands/set-area-selection-mode";

const SELECTION_MODES = [
  {
    mode: Mode.SELECT_RECTANGULAR,
    key: "areaSelection.rectangular",
    Icon: RectangularSelectionIcon,
  },
  {
    mode: Mode.SELECT_POLYGONAL,
    key: "areaSelection.polygonal",
    Icon: PolygonalSelectionIcon,
  },
  {
    mode: Mode.SELECT_FREEHAND,
    key: "areaSelection.freehand",
    Icon: FreeHandSelectionIcon,
  },
] as const;

export const SelectionToolDropdown = () => {
  const translate = useTranslate();
  const setDrawingMode = useDrawingMode();
  const { mode: currentMode } = useAtomValue(modeAtom);

  const currentSelection =
    SELECTION_MODES.find((m) => m.mode === currentMode) || SELECTION_MODES[0];

  const isSelectionModeActive = SELECTION_MODES.some(
    (m) => m.mode === currentMode,
  );

  const CurrentIcon = currentSelection.Icon;

  return (
    <Tooltip.Root delayDuration={200}>
      <div className="h-10 w-12 group bn flex items-stretch py-1 focus:outline-none">
        <DD.Root>
          <Tooltip.Trigger asChild>
            <DD.Trigger asChild>
              <Button
                variant={isSelectionModeActive ? "quiet/mode" : "quiet"}
                aria-expanded={isSelectionModeActive ? "true" : "false"}
              >
                <CurrentIcon />
                <ChevronDownIcon size="sm" />
              </Button>
            </DD.Trigger>
          </Tooltip.Trigger>
          <DD.Portal>
            <DDContent align="start" side="bottom">
              {SELECTION_MODES.map(({ mode, key, Icon }) => (
                <StyledItem
                  key={mode}
                  onSelect={() => {
                    setDrawingMode(mode);
                  }}
                >
                  <Icon />
                  {translate(key)}
                </StyledItem>
              ))}
            </DDContent>
          </DD.Portal>
        </DD.Root>
      </div>
      <TContent side="bottom">
        <div className="flex gap-x-2 items-center">
          {translate("areaSelection.tool")}
          <Keycap size="xs">{localizeKeybinding(selectionModeShortcut)}</Keycap>
        </div>
      </TContent>
    </Tooltip.Root>
  );
};
