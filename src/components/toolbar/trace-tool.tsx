import React, { useCallback, useEffect, useRef, useState } from "react";
import * as DD from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";

import {
  BoundaryTraceIcon,
  UpstreamTraceIcon,
  DownstreamTraceIcon,
} from "src/icons";
import { useDrawingMode } from "src/commands/set-drawing-mode";
import { Mode, MODE_INFO, lastTraceSelectModeAtom } from "src/state/mode";
import { useAtom, useAtomValue } from "jotai";
import { modeAtom } from "src/state/jotai";
import { Button, DDContent, Keycap, StyledItem, TContent } from "../elements";
import { useTranslate } from "src/hooks/use-translate";
import { localizeKeybinding } from "src/infra/i18n";
import {
  traceSelectModeShortcut,
  useCycleTraceSelectMode,
} from "src/commands/set-trace-select-mode";
import { useUserTracking } from "src/infra/user-tracking";

const TRACE_MODES = new Map([
  [
    Mode.BOUNDARY_TRACE_SELECT,
    { key: "traceSelection.boundary", Icon: BoundaryTraceIcon },
  ],
  [
    Mode.UPSTREAM_TRACE_SELECT,
    { key: "traceSelection.upstream", Icon: UpstreamTraceIcon },
  ],
  [
    Mode.DOWNSTREAM_TRACE_SELECT,
    { key: "traceSelection.downstream", Icon: DownstreamTraceIcon },
  ],
]);

const LONG_PRESS_DURATION_MS = 500;

export const TraceTool = () => {
  const translate = useTranslate();
  const setDrawingMode = useDrawingMode();
  const { mode: currentMode } = useAtomValue(modeAtom);
  const userTracking = useUserTracking();
  const [lastTraceMode, setLastTraceMode] = useAtom(lastTraceSelectModeAtom);
  const cycleTraceSelectMode = useCycleTraceSelectMode();

  const [isOpen, setIsOpen] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const wasLongPressRef = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  const isTraceModeActive = TRACE_MODES.has(currentMode);

  const displayedMode = isTraceModeActive ? currentMode : lastTraceMode;
  const displayedTrace =
    TRACE_MODES.get(displayedMode) ??
    TRACE_MODES.get(Mode.BOUNDARY_TRACE_SELECT)!;

  const DisplayedIcon = displayedTrace.Icon;

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const selectMode = useCallback(
    (mode: Mode) => {
      setLastTraceMode(mode);
      userTracking.capture({
        name: "drawingMode.enabled",
        source: "toolbar",
        type: MODE_INFO[mode].name,
      });
      setDrawingMode(mode);
      setIsOpen(false);
    },
    [setLastTraceMode, userTracking, setDrawingMode],
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
      const mode = cycleTraceSelectMode();
      userTracking.capture({
        name: "drawingMode.enabled",
        source: "toolbar",
        type: MODE_INFO[mode].name,
      });
    }
  }, [isOpen, cycleTraceSelectMode, userTracking]);

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
                  className="relative"
                  role="radio"
                  aria-checked={isTraceModeActive}
                  aria-expanded={isOpen || isTraceModeActive ? "true" : "false"}
                  aria-label={translate("traceSelection.tool")}
                  onPointerDown={handlePointerDown}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerLeave}
                  onContextMenu={handleContextMenu}
                >
                  <DisplayedIcon />
                  <span
                    className="absolute bottom-1 right-1 border-l-[5px] border-l-transparent border-b-[5px] border-b-gray-400 aria-expanded:border-b-white"
                    aria-expanded={
                      isOpen || isTraceModeActive ? "true" : "false"
                    }
                    aria-hidden="true"
                  />
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
                {[...TRACE_MODES].map(([mode, { key, Icon }]) => (
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
            {translate("traceSelection.tool")}
            <Keycap size="xs">
              {localizeKeybinding(traceSelectModeShortcut)}
            </Keycap>
          </div>
        </TContent>
      </Tooltip.Root>
    </div>
  );
};
