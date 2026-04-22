import React, { useCallback, useEffect, useRef, useState } from "react";
import * as DD from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useAtom, useAtomValue } from "jotai";

import {
  Button,
  DDContent,
  StyledItem,
  TContent,
} from "src/components/elements";
import {
  useCycleDrawingMode,
  useDrawingMode,
} from "src/commands/set-drawing-mode";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { lastDrawingModeAtom, Mode, MODE_INFO, modeAtom } from "src/state/mode";
import { DRAWING_MODE_OPTIONS } from "./modes";

const LONG_PRESS_DURATION_MS = 500;

export const DrawingToolDropdown = ({
  disabled = false,
}: {
  disabled?: boolean;
}) => {
  const translate = useTranslate();
  const setDrawingMode = useDrawingMode();
  const cycleDrawingMode = useCycleDrawingMode();
  const userTracking = useUserTracking();
  const { mode: currentMode } = useAtomValue(modeAtom);
  const [lastDrawingMode, setLastDrawingMode] = useAtom(lastDrawingModeAtom);
  const [isOpen, setIsOpen] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const wasLongPressRef = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const activeOption =
    DRAWING_MODE_OPTIONS.find((option) => option.mode === currentMode) ?? null;
  const displayedOption =
    activeOption ??
    DRAWING_MODE_OPTIONS.find((option) => option.mode === lastDrawingMode) ??
    DRAWING_MODE_OPTIONS[0];
  const DisplayedIcon = displayedOption.Icon;
  const isDrawingActive = activeOption !== null;

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

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

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      if (disabled) return;
      if (e.button === 2) return;
      wasLongPressRef.current = false;
      longPressTimerRef.current = window.setTimeout(() => {
        wasLongPressRef.current = true;
        setIsOpen(true);
      }, LONG_PRESS_DURATION_MS);
    },
    [disabled],
  );

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (disabled) return;
    if (!wasLongPressRef.current && !isOpen) {
      const mode = cycleDrawingMode();
      userTracking.capture({
        name: "drawingMode.enabled",
        source: "toolbar",
        type: MODE_INFO[mode].name,
      });
    }
  }, [isOpen, cycleDrawingMode, userTracking, disabled]);

  const handlePointerLeave = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (disabled) return;
      setIsOpen(true);
    },
    [disabled],
  );

  return (
    <div className="relative">
      <Tooltip.Root delayDuration={200}>
        <div className="h-10 w-8 group bn flex items-stretch py-1 focus:outline-none">
          <DD.Root open={isOpen} onOpenChange={setIsOpen}>
            <DD.Trigger asChild>
              <Tooltip.Trigger asChild>
                <Button
                  ref={buttonRef}
                  variant="quiet/mode"
                  className="relative"
                  disabled={disabled}
                  role="radio"
                  aria-label={translate("drawingTools")}
                  aria-checked={isDrawingActive}
                  aria-expanded={isOpen || isDrawingActive ? "true" : "false"}
                  onPointerDown={handlePointerDown}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerLeave}
                  onContextMenu={handleContextMenu}
                >
                  <DisplayedIcon />
                  <span
                    className="absolute bottom-1 right-1 border-l-[5px] border-l-transparent border-b-[5px] border-b-gray-400 aria-expanded:border-b-white"
                    aria-expanded={isOpen || isDrawingActive ? "true" : "false"}
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
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
                {DRAWING_MODE_OPTIONS.map(({ mode, Icon }) => (
                  <StyledItem key={mode} onSelect={() => selectMode(mode)}>
                    <Icon />
                    {translate(MODE_INFO[mode].name)}
                  </StyledItem>
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
