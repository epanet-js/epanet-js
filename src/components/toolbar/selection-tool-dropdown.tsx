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
import { Mode, MODE_INFO } from "src/state/mode";
import { useAtomValue } from "jotai";
import { modeAtom } from "src/state/jotai";
import { Button, DDContent, Keycap, StyledItem, TContent } from "../elements";
import { useTranslate } from "src/hooks/use-translate";
import { localizeKeybinding } from "src/infra/i18n";
import { selectionModeShortcut } from "src/commands/set-area-selection-mode";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import MenuAction from "../menu-action";
import { useUserTracking } from "src/infra/user-tracking";

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

const SelectionToolDropdown = () => {
  const translate = useTranslate();
  const setDrawingMode = useDrawingMode();
  const { mode: currentMode } = useAtomValue(modeAtom);
  const userTracking = useUserTracking();

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
                    userTracking.capture({
                      name: "drawingMode.enabled",
                      source: "toolbar",
                      type: MODE_INFO[mode].name,
                    });
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

const SelectionToolButton = () => {
  const translate = useTranslate();
  const setDrawingMode = useDrawingMode();
  const { mode: currentMode } = useAtomValue(modeAtom);
  const userTracking = useUserTracking();

  return (
    <MenuAction
      role="radio"
      selected={currentMode === Mode.SELECT_POLYGONAL}
      readOnlyHotkey={selectionModeShortcut}
      label={translate("areaSelection.tool")}
      onClick={() => {
        userTracking.capture({
          name: "drawingMode.enabled",
          source: "toolbar",
          type: MODE_INFO[Mode.SELECT_POLYGONAL].name,
        });
        setDrawingMode(Mode.SELECT_POLYGONAL);
      }}
    >
      <PolygonalSelectionIcon />
    </MenuAction>
  );
};

export const SelectionTool = () => {
  const isSelectionModeChoiceEnabled = useFeatureFlag(
    "FLAG_SELECTION_MODE_CHOICE",
  );

  if (isSelectionModeChoiceEnabled) {
    return <SelectionToolDropdown />;
  }

  return <SelectionToolButton />;
};
