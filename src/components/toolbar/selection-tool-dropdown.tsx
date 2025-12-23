import React, { useCallback, useEffect, useRef, useState } from "react";
import * as DD from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";

import {
  RectangularSelectionIcon,
  PolygonalSelectionIcon,
  FreeHandSelectionIcon,
} from "src/icons";
import { useDrawingMode } from "src/commands/set-drawing-mode";
import { Mode, MODE_INFO, lastSelectionModeAtom } from "src/state/mode";
import { useAtom, useAtomValue } from "jotai";
import { modeAtom } from "src/state/jotai";
import { Button, DDContent, Keycap, StyledItem, TContent } from "../elements";
import { useTranslate } from "src/hooks/use-translate";
import { localizeKeybinding } from "src/infra/i18n";
import {
  selectionModeShortcut,
  useCycleSelectionMode,
} from "src/commands/set-area-selection-mode";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import MenuAction from "../menu-action";
import { useUserTracking } from "src/infra/user-tracking";

const SELECTION_MODES = new Map([
  [
    Mode.SELECT_RECTANGULAR,
    { key: "areaSelection.rectangular", Icon: RectangularSelectionIcon },
  ],
  [
    Mode.SELECT_POLYGONAL,
    { key: "areaSelection.polygonal", Icon: PolygonalSelectionIcon },
  ],
  [
    Mode.SELECT_FREEHAND,
    { key: "areaSelection.freehand", Icon: FreeHandSelectionIcon },
  ],
]);

const LONG_PRESS_DURATION_MS = 500;

const SelectionToolDropdown = () => {
  const translate = useTranslate();
  const setDrawingMode = useDrawingMode();
  const { mode: currentMode } = useAtomValue(modeAtom);
  const userTracking = useUserTracking();
  const [lastSelectionMode, setLastSelectionMode] = useAtom(
    lastSelectionModeAtom,
  );
  const cycleSelectionMode = useCycleSelectionMode();

  const [isOpen, setIsOpen] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const wasLongPressRef = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  const isSelectionModeActive = SELECTION_MODES.has(currentMode);

  const displayedMode = isSelectionModeActive ? currentMode : lastSelectionMode;
  const displayedSelection =
    SELECTION_MODES.get(displayedMode) ??
    SELECTION_MODES.get(Mode.SELECT_POLYGONAL)!;

  const DisplayedIcon = displayedSelection.Icon;

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const selectMode = useCallback(
    (mode: Mode) => {
      setLastSelectionMode(mode);
      userTracking.capture({
        name: "drawingMode.enabled",
        source: "toolbar",
        type: MODE_INFO[mode].name,
      });
      setDrawingMode(mode);
      setIsOpen(false);
    },
    [setLastSelectionMode, userTracking, setDrawingMode],
  );

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Prevent Radix's default dropdown toggle behavior
    e.preventDefault();

    if (e.button === 2) return; // Right-click handled by context menu
    wasLongPressRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      wasLongPressRef.current = true;
      setIsOpen(true);
    }, LONG_PRESS_DURATION_MS);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!wasLongPressRef.current && !isOpen) {
      const mode = cycleSelectionMode();
      userTracking.capture({
        name: "drawingMode.enabled",
        source: "toolbar",
        type: MODE_INFO[mode].name,
      });
    }
  }, [isOpen, cycleSelectionMode, userTracking]);

  const handlePointerLeave = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsOpen(true);
  }, []);

  return (
    <div className="relative">
      <Tooltip.Root delayDuration={200}>
        <div className="h-10 w-8 group bn flex items-stretch py-1 focus:outline-none">
          <DD.Root open={isOpen} onOpenChange={handleOpenChange}>
            <DD.Trigger asChild>
              <Tooltip.Trigger asChild>
                <Button
                  ref={buttonRef}
                  variant="quiet/mode"
                  role="radio"
                  aria-checked={isSelectionModeActive}
                  aria-expanded={
                    isOpen || isSelectionModeActive ? "true" : "false"
                  }
                  aria-label={translate("areaSelection.tool")}
                  onPointerDown={handlePointerDown}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerLeave}
                  onContextMenu={handleContextMenu}
                >
                  <DisplayedIcon />
                </Button>
              </Tooltip.Trigger>
            </DD.Trigger>
            <DD.Portal>
              <DDContent
                align="start"
                side="bottom"
                onEscapeKeyDown={() => {
                  buttonRef.current?.blur();
                }}
                onCloseAutoFocus={(e) => {
                  e.preventDefault();
                }}
              >
                {[...SELECTION_MODES].map(([mode, { key, Icon }]) => (
                  <StyledItem key={mode} onSelect={() => selectMode(mode)}>
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
            <Keycap size="xs">
              {localizeKeybinding(selectionModeShortcut)}
            </Keycap>
          </div>
        </TContent>
      </Tooltip.Root>
    </div>
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
