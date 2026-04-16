import { useAtomValue } from "jotai";
import clsx from "clsx";
import * as Popover from "@radix-ui/react-popover";
import * as DD from "@radix-ui/react-dropdown-menu";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
} from "src/icons";
import { Button, DDContent, StyledRadioItem } from "src/components/elements";
import { simulationStepAtom } from "src/state/simulation";
import { simulationDerivedAtom } from "src/state/derived-branch-state";
import { triggerStylesFor } from "./form/selector";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useBreakpoint } from "src/hooks/use-breakpoint";
import {
  useChangeTimestep,
  ChangeTimestepSource,
} from "src/commands/change-timestep";
import { simulationPlaybackAtom } from "src/state/simulation-playback";
import { useTogglePlayback } from "src/commands/toggle-playback";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useTranslate } from "src/hooks/use-translate";

export const TimestepSelector = () => {
  const simulationStep = useAtomValue(simulationStepAtom);
  const simulation = useAtomValue(simulationDerivedAtom);
  const { changeTimestep } = useChangeTimestep();
  const isSmOrLarger = useBreakpoint("sm");

  if (!isSmOrLarger) return null;
  if (simulationStep === null) return null;
  if (!("epsResultsReader" in simulation) || !simulation.epsResultsReader)
    return null;

  const { timestepCount, reportingTimeStep } = simulation.epsResultsReader;
  if (timestepCount <= 1) return null;

  return (
    <TimestepSelectorUI
      currentTimestepIndex={simulationStep}
      timestepCount={timestepCount}
      reportTimestep={reportingTimeStep}
      onChangeTimestep={changeTimestep}
    />
  );
};

type TimestepSelectorUIProps = {
  currentTimestepIndex: number;
  timestepCount: number;
  reportTimestep: number;
  onChangeTimestep: (index: number, source: ChangeTimestepSource) => void;
};

export const TimestepSelectorUI = ({
  currentTimestepIndex,
  timestepCount,
  reportTimestep,
  onChangeTimestep,
}: TimestepSelectorUIProps) => {
  const translate = useTranslate();
  const isAnimateSimulationOn = useFeatureFlag("FLAG_ANIMATE_SIMULATION");
  const canGoPrevious = currentTimestepIndex > 0;
  const canGoNext = currentTimestepIndex < timestepCount - 1;

  const { stopPlayback } = useTogglePlayback();
  const { goToPreviousTimestep, goToNextTimestep } = useChangeTimestep();

  return (
    <div className="absolute top-3 right-3 flex items-center gap-1 p-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-black rounded-sm shadow-sm">
      {isAnimateSimulationOn && <PlayButton />}
      <Button
        variant="quiet/mode"
        className="h-8"
        aria-label={translate("previousTimestep")}
        onClick={() => goToPreviousTimestep("buttons")}
        disabled={!canGoPrevious}
      >
        <ChevronLeftIcon />
      </Button>
      <Button
        variant="quiet/mode"
        className="h-8"
        aria-label={translate("nextTimestep")}
        onClick={() => goToNextTimestep("buttons")}
        disabled={!canGoNext}
      >
        <ChevronRightIcon />
      </Button>
      <TimestepDropdown
        currentTimestepIndex={currentTimestepIndex}
        timestepCount={timestepCount}
        reportTimestep={reportTimestep}
        onOpen={() => stopPlayback("dropdown")}
        onChangeTimestep={(index) => onChangeTimestep(index, "dropdown")}
      />
    </div>
  );
};

type PlaybackSpeed = 2000 | 1000 | 500 | 250;

const SPEED_OPTIONS: { label: string; value: PlaybackSpeed }[] = [
  { label: "x1", value: 1000 },
  { label: "x2", value: 500 },
  { label: "x4", value: 250 },
];

const LONG_PRESS_DURATION_MS = 500;

const PlayButton = () => {
  const translate = useTranslate();
  const { playbackSpeedMs, isPlaying } = useAtomValue(simulationPlaybackAtom);
  const { togglePlayback, changePlaybackSpeed } = useTogglePlayback();

  const [isOpen, setIsOpen] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const wasLongPressRef = useRef(false);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  const openDropdown = useCallback(() => {
    if (!isPlaying) setIsOpen(true);
  }, [isPlaying]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      if (e.button === 2) return;
      wasLongPressRef.current = false;
      longPressTimerRef.current = window.setTimeout(() => {
        wasLongPressRef.current = true;
        openDropdown();
      }, LONG_PRESS_DURATION_MS);
    },
    [openDropdown],
  );

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!wasLongPressRef.current && !isOpen) {
      togglePlayback("buttons");
    }
  }, [isOpen, togglePlayback]);

  const handlePointerLeave = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      openDropdown();
    },
    [openDropdown],
  );

  const currentSpeed =
    SPEED_OPTIONS.find((o) => o.value === playbackSpeedMs) ?? SPEED_OPTIONS[0];

  return (
    <DD.Root open={isOpen} onOpenChange={setIsOpen}>
      <DD.Trigger asChild>
        <Button
          variant="quiet/mode"
          className="relative h-8"
          aria-label={
            isPlaying ? translate("pausePlayback") : translate("playSimulation")
          }
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onContextMenu={handleContextMenu}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
          {!isPlaying && (
            <span
              className="absolute bottom-0.5 right-1 flex items-end gap-px"
              aria-hidden="true"
            >
              {currentSpeed.value !== 1000 && (
                <span className="text-[9px] leading-none text-gray-500 font-medium">
                  {currentSpeed.label}
                </span>
              )}
              <span className="border-l-[6px] border-l-transparent border-b-[6px] border-b-gray-400" />
            </span>
          )}
        </Button>
      </DD.Trigger>
      <DD.Portal>
        <DDContent align="start" sideOffset={4}>
          <DD.RadioGroup
            value={String(currentSpeed.value)}
            onValueChange={(v) => {
              changePlaybackSpeed(Number(v) as PlaybackSpeed);
              setIsOpen(false);
              togglePlayback("buttons");
            }}
          >
            {SPEED_OPTIONS.map(({ label, value }) => (
              <StyledRadioItem key={value} value={String(value)}>
                {label}
                <DD.ItemIndicator>
                  <CheckIcon className="text-purple-700" />
                </DD.ItemIndicator>
              </StyledRadioItem>
            ))}
          </DD.RadioGroup>
        </DDContent>
      </DD.Portal>
    </DD.Root>
  );
};

const ROW_HEIGHT = 32;
const LIST_MAX_HEIGHT = 240;

type TimestepDropdownProps = {
  currentTimestepIndex: number;
  timestepCount: number;
  reportTimestep: number;
  onOpen?: () => void;
  onChangeTimestep: (index: number) => void;
};

const TimestepDropdown = ({
  currentTimestepIndex,
  timestepCount,
  reportTimestep,
  onOpen,
  onChangeTimestep,
}: TimestepDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );
  const triggerStyles = triggerStylesFor({ paddingX: 1.5, paddingY: 1 });

  const virtualizer = useVirtualizer({
    count: timestepCount,
    getScrollElement: () => scrollElement,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  useEffect(() => {
    if (!isOpen || !scrollElement) return;
    virtualizer.scrollToIndex(currentTimestepIndex, { align: "center" });
  }, [isOpen, scrollElement, currentTimestepIndex, virtualizer]);

  return (
    <Popover.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (open) onOpen?.();
        setIsOpen(open);
      }}
    >
      <Popover.Trigger
        aria-label="Select timestep"
        className={triggerStyles}
        tabIndex={1}
      >
        <div className="text-nowrap overflow-hidden text-ellipsis">
          {formatTimestepTime(currentTimestepIndex, reportTimestep)}
        </div>
        <div className="px-1">
          <ChevronDownIcon />
        </div>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={4}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-black text-sm rounded-md shadow-md z-50 overflow-hidden min-w-[var(--radix-popover-trigger-width)]"
          onKeyDown={(event) => {
            if (event.code === "Escape" || event.code === "Enter") {
              event.stopPropagation();
              setIsOpen(false);
            }
          }}
        >
          <div
            ref={setScrollElement}
            className="overflow-y-auto p-1"
            style={{ maxHeight: LIST_MAX_HEIGHT }}
          >
            <div
              style={{
                height: virtualizer.getTotalSize(),
                position: "relative",
                width: "100%",
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const index = virtualRow.index;
                const isSelected = index === currentTimestepIndex;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      onChangeTimestep(index);
                      setIsOpen(false);
                    }}
                    className={clsx(
                      "absolute left-0 right-0 flex items-center justify-between gap-4 px-2",
                      "text-left cursor-pointer hover:bg-purple-300/40 focus:bg-purple-300/40 rounded-sm",
                    )}
                    style={{
                      height: ROW_HEIGHT,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <span>{formatTimestepTime(index, reportTimestep)}</span>
                    {isSelected && (
                      <CheckIcon className="text-purple-700 ml-auto" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

function formatTimestepTime(timestepIndex: number, intervalSeconds = 3600) {
  const totalSeconds = timestepIndex * intervalSeconds;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
