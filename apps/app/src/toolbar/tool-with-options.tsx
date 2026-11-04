import React, { useCallback, useEffect, useRef, useState } from "react";
import * as DD from "@radix-ui/react-dropdown-menu";
import { Tooltip } from "@epanet-js/ui-kit";
import { useAtom, useAtomValue, type PrimitiveAtom } from "jotai";

import { useDrawingMode } from "src/commands/set-drawing-mode";
import { Mode, MODE_INFO, modeAtom } from "src/state/mode";
import { Button, DDContent, Keycap, StyledItem } from "src/components/elements";
import { localizeKeybinding } from "src/infra/i18n";
import { useUserTracking } from "src/infra/user-tracking";

export type ToolOption = {
  mode: Mode;
  label: string;
  Icon: React.ComponentType;
};

const LONG_PRESS_DURATION_MS = 500;

export const ToolWithOptions = ({
  label,
  shortcut,
  options,
  lastModeAtom,
  cycleMode,
  disabled = false,
}: {
  label: string;
  shortcut?: string;
  options: readonly ToolOption[];
  lastModeAtom: PrimitiveAtom<Mode>;
  cycleMode: () => Mode;
  disabled?: boolean;
}) => {
  const setDrawingMode = useDrawingMode();
  const { mode: currentMode } = useAtomValue(modeAtom);
  const userTracking = useUserTracking();
  const [lastMode, setLastMode] = useAtom(lastModeAtom);

  const [isOpen, setIsOpen] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const isPressedRef = useRef(false);
  const wasLongPressRef = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  const activeOption = options.find((option) => option.mode === currentMode);
  const isActive = activeOption !== undefined;
  const displayedOption =
    activeOption ??
    options.find((option) => option.mode === lastMode) ??
    options[0];

  const DisplayedIcon = displayedOption.Icon;

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const selectMode = useCallback(
    (mode: Mode) => {
      setLastMode(mode);
      userTracking.capture({
        name: "drawingMode.enabled",
        source: "toolbar",
        type: MODE_INFO[mode].name,
      });
      void setDrawingMode(mode);
      setIsOpen(false);
    },
    [setLastMode, userTracking, setDrawingMode],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Prevent Radix's default dropdown toggle behavior
      e.preventDefault();

      if (disabled) return;
      if (e.button === 2) return; // Right-click handled by context menu
      isPressedRef.current = true;
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
    if (!isPressedRef.current) return;
    isPressedRef.current = false;
    if (!wasLongPressRef.current && !isOpen) {
      const mode = cycleMode();
      userTracking.capture({
        name: "drawingMode.enabled",
        source: "toolbar",
        type: MODE_INFO[mode].name,
      });
    }
  }, [isOpen, cycleMode, userTracking]);

  const handlePointerLeave = useCallback(() => {
    isPressedRef.current = false;
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

  const isExpanded = isOpen || isActive ? "true" : "false";

  return (
    <div className="relative">
      <div className="h-10 w-8 group bn flex items-stretch py-1 focus:outline-hidden">
        <DD.Root open={isOpen} onOpenChange={handleOpenChange}>
          <Tooltip
            content={
              shortcut ? (
                <div className="flex gap-x-2 items-center">
                  {label}
                  <Keycap size="xs">{localizeKeybinding(shortcut)}</Keycap>
                </div>
              ) : (
                label
              )
            }
          >
            <DD.Trigger asChild>
              <Button
                ref={buttonRef}
                variant="quiet/mode"
                className="relative"
                disabled={disabled}
                role="radio"
                aria-checked={isActive}
                aria-expanded={isExpanded}
                aria-label={label}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerLeave}
                onContextMenu={handleContextMenu}
              >
                <DisplayedIcon />
                <span
                  className="absolute bottom-1 right-1 border-l-[5px] border-l-transparent border-b-[5px] border-b-gray-400 aria-expanded:border-b-white"
                  aria-expanded={isExpanded}
                  aria-hidden="true"
                />
              </Button>
            </DD.Trigger>
          </Tooltip>
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
              {options.map(({ mode, label, Icon }) => (
                <StyledItem key={mode} onSelect={() => selectMode(mode)}>
                  <Icon />
                  {label}
                </StyledItem>
              ))}
            </DDContent>
          </DD.Portal>
        </DD.Root>
      </div>
    </div>
  );
};
