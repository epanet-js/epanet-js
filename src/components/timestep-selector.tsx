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
  WarningIcon,
} from "src/icons";
import { Button, DDContent, StyledRadioItem } from "src/components/elements";
import { simulationStepAtom } from "src/state/simulation";
import { simulationDerivedAtom } from "src/state/derived-branch-state";
import { triggerStylesFor } from "./form/selector";
import React, { useEffect, useState } from "react";
import { useBreakpoint } from "src/hooks/use-breakpoint";
import {
  useChangeTimestep,
  ChangeTimestepSource,
} from "src/commands/change-timestep";
import {
  simulationPlaybackAtom,
  isPlayingAtom,
  maximumPlaybackSpeedAtom,
  resolveSpeedByMode,
  type PlaybackSpeed,
  autoPlaybackSpeedAtom,
  currentSpeedWarningAtom,
} from "src/state/simulation-playback";
import { useTogglePlayback } from "src/commands/toggle-playback";
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

  const reader = simulation.epsResultsReader;
  const { timestepCount, reportingTimeStep } = reader;
  if (timestepCount <= 1) return null;

  // Transient readers format sub-second timestamps (ms/s); EPS uses HH:MM.
  const formatTime = reader.formatTime
    ? (index: number) => reader.formatTime!(index)
    : undefined;

  return (
    <TimestepSelectorUI
      currentTimestepIndex={simulationStep}
      timestepCount={timestepCount}
      reportTimestep={reportingTimeStep}
      formatTime={formatTime}
      onChangeTimestep={changeTimestep}
    />
  );
};

type TimestepSelectorUIProps = {
  currentTimestepIndex: number;
  timestepCount: number;
  reportTimestep: number;
  formatTime?: (index: number) => string;
  onChangeTimestep: (index: number, source: ChangeTimestepSource) => void;
};

export const TimestepSelectorUI = ({
  currentTimestepIndex,
  timestepCount,
  reportTimestep,
  formatTime,
  onChangeTimestep,
}: TimestepSelectorUIProps) => {
  const translate = useTranslate();
  const canGoPrevious = currentTimestepIndex > 0;
  const canGoNext = currentTimestepIndex < timestepCount - 1;

  const { stopPlayback } = useTogglePlayback();
  const { goToPreviousTimestep, goToNextTimestep } = useChangeTimestep();
  const speedWarning = useAtomValue(currentSpeedWarningAtom);
  const isPlaying = useAtomValue(isPlayingAtom);

  return (
    <div className="grid grid-cols-[min-content] gap-1">
      <div className="flex items-center gap-1 p-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-black rounded-xs shadow-[0_2px_10px_2px_rgba(0,0,0,0.1)]">
        <PlayButton />
        <SpeedButton />
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
          formatTime={formatTime}
          onOpen={() => stopPlayback("dropdown")}
          onChangeTimestep={(index) => onChangeTimestep(index, "dropdown")}
        />
      </div>
      {isPlaying && speedWarning && (
        <div className="flex items-start gap-1.5 text-xs bg-gray-100 dark:bg-gray-900/80 px-2 py-1 rounded-xs shadow-[0_2px_10px_2px_rgba(0,0,0,0.1)]">
          <WarningIcon className="shrink-0 mt-px text-orange-500" />
          <span className="wrap-break-word min-w-0">
            {translate(
              speedWarning === "slow"
                ? "playbackSpeedWarningSlow"
                : "playbackSpeedWarningTooFast",
            )}
          </span>
        </div>
      )}
    </div>
  );
};

const SPEED_OPTIONS: { translationKey: string; value: PlaybackSpeed }[] = [
  { translationKey: "playbackSpeedAuto", value: "auto" },
  { translationKey: "playbackSpeedX2", value: "x2" },
  { translationKey: "playbackSpeedX4", value: "x4" },
];

const PlayButton = () => {
  const translate = useTranslate();
  const isPlaying = useAtomValue(isPlayingAtom);
  const { togglePlayback } = useTogglePlayback();

  return (
    <Button
      variant="quiet/mode"
      className="h-8"
      aria-label={
        isPlaying ? translate("pausePlayback") : translate("playSimulation")
      }
      onClick={() => togglePlayback("buttons")}
    >
      {isPlaying ? <PauseIcon /> : <PlayIcon />}
    </Button>
  );
};

const SpeedButton = () => {
  const translate = useTranslate();
  const { playbackSpeed } = useAtomValue(simulationPlaybackAtom);
  const maxPlaybackSpeedMs = useAtomValue(maximumPlaybackSpeedAtom);
  const autoSpeedMs = useAtomValue(autoPlaybackSpeedAtom);
  const { changePlaybackSpeed } = useTogglePlayback();
  const [isOpen, setIsOpen] = useState(false);

  const speedOptions = SPEED_OPTIONS.map((option) => ({
    ...option,
    warning:
      option.value === "auto"
        ? autoSpeedMs > 1000
        : resolveSpeedByMode(autoSpeedMs, option.value) < maxPlaybackSpeedMs,
  }));

  const currentSpeed =
    SPEED_OPTIONS.find((o) => o.value === playbackSpeed) ?? SPEED_OPTIONS[0];

  return (
    <DD.Root open={isOpen} onOpenChange={setIsOpen}>
      <DD.Trigger asChild>
        <Button
          variant="quiet/mode"
          size="xxs"
          className="h-8 px-1 rounded-sm"
          aria-label={translate("selectPlaybackSpeed")}
        >
          <div className="leading-none text-center">
            {translate(currentSpeed.translationKey)}
          </div>
          <ChevronDownIcon size="sm" />
        </Button>
      </DD.Trigger>
      <DD.Portal>
        <DDContent align="start" sideOffset={4}>
          <DD.RadioGroup
            value={currentSpeed.value}
            onValueChange={(v) => {
              changePlaybackSpeed(v as PlaybackSpeed);
              setIsOpen(false);
            }}
          >
            {speedOptions.map(({ translationKey, value, warning }) => (
              <StyledRadioItem key={value} value={value}>
                <span className="flex-1">{translate(translationKey)}</span>
                {warning && <WarningIcon className="text-orange-500" />}
                <span className="w-4 flex items-center justify-center">
                  <DD.ItemIndicator>
                    <CheckIcon className="text-purple-700" />
                  </DD.ItemIndicator>
                </span>
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
  formatTime?: (index: number) => string;
  onOpen?: () => void;
  onChangeTimestep: (index: number) => void;
};

const TimestepDropdown = ({
  currentTimestepIndex,
  timestepCount,
  reportTimestep,
  formatTime,
  onOpen,
  onChangeTimestep,
}: TimestepDropdownProps) => {
  const labelFor = (index: number) =>
    formatTime ? formatTime(index) : formatTimestepTime(index, reportTimestep);
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
          {labelFor(currentTimestepIndex)}
        </div>
        <div className="px-1">
          <ChevronDownIcon />
        </div>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={4}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-black text-sm rounded-md shadow-md z-50 overflow-hidden min-w-(--radix-popover-trigger-width)"
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
                      "text-left cursor-pointer hover:bg-purple-300/40 focus:bg-purple-300/40 rounded-xs",
                    )}
                    style={{
                      height: ROW_HEIGHT,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <span>{labelFor(index)}</span>
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
