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
import { useEffect, useState } from "react";
import { useBreakpoint } from "src/hooks/use-breakpoint";
import {
  useChangeTimestep,
  ChangeTimestepSource,
} from "src/commands/change-timestep";
import { simulationPlaybackAtom } from "src/state/simulation-playback";
import { useTogglePlayback } from "src/commands/toggle-playback";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

type PlaybackSpeed = 2000 | 1000 | 500 | 250;

const SPEED_OPTIONS: { label: string; value: PlaybackSpeed }[] = [
  { label: "0.5×", value: 2000 },
  { label: "1×", value: 1000 },
  { label: "2×", value: 500 },
  { label: "4×", value: 250 },
];

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
  const isAnimateSimulationOn = useFeatureFlag("FLAG_ANIMATE_SIMULATION");
  const canGoPrevious = currentTimestepIndex > 0;
  const canGoNext = currentTimestepIndex < timestepCount - 1;

  const playback = useAtomValue(simulationPlaybackAtom);
  const { togglePlayback, stopPlayback, changePlaybackSpeed } =
    useTogglePlayback();
  const { goToPreviousTimestep, goToNextTimestep } = useChangeTimestep();
  const isPlaying = playback.isPlaying;
  const playbackSpeed = playback.playbackSpeedMs as PlaybackSpeed;

  return (
    <div className="absolute top-3 right-3 flex items-center gap-1 p-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-black rounded-sm shadow-sm">
      <button
        onClick={() => goToPreviousTimestep("buttons")}
        disabled={!canGoPrevious}
        className={clsx(
          "size-[1.875rem] p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-l-sm",
          "active:bg-gray-300 dark:active:bg-gray-600",
          "disabled:opacity-40 disabled:active:bg-gray-200 disabled:cursor-not-allowed",
        )}
        aria-label="Previous timestep"
      >
        <ChevronLeftIcon />
      </button>
      <button
        onClick={() => goToNextTimestep("buttons")}
        disabled={!canGoNext}
        className={clsx(
          "size-[1.875rem] p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-r-sm",
          "active:bg-gray-300 dark:active:bg-gray-600",
          "disabled:opacity-40 disabled:active:bg-gray-200 disabled:cursor-not-allowed",
        )}
        aria-label="Next timestep"
      >
        <ChevronRightIcon />
      </button>
      <TimestepDropdown
        currentTimestepIndex={currentTimestepIndex}
        timestepCount={timestepCount}
        reportTimestep={reportTimestep}
        onOpen={() => stopPlayback("dropdown")}
        onChangeTimestep={(index) => onChangeTimestep(index, "dropdown")}
      />
      {isAnimateSimulationOn && (
        <>
          <Button
            onClick={() => togglePlayback("buttons")}
            variant="quiet"
            size="xs"
            aria-label={isPlaying ? "Pause playback" : "Play simulation"}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </Button>
          <PlaybackSpeedDropdown
            playbackSpeed={playbackSpeed}
            onSpeedChange={changePlaybackSpeed}
          />
        </>
      )}
    </div>
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

type PlaybackSpeedDropdownProps = {
  playbackSpeed: PlaybackSpeed;
  onSpeedChange: (speed: PlaybackSpeed) => void;
};

const PlaybackSpeedDropdown = ({
  playbackSpeed,
  onSpeedChange,
}: PlaybackSpeedDropdownProps) => {
  return (
    <DD.Root>
      <DD.Trigger asChild>
        <button
          className={clsx(
            "size-[1.875rem] p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-sm",
            "active:bg-gray-300 dark:active:bg-gray-600",
          )}
          aria-label="Playback speed"
        >
          <ChevronDownIcon />
        </button>
      </DD.Trigger>
      <DD.Portal>
        <DDContent align="end" sideOffset={4}>
          <DD.RadioGroup
            value={String(playbackSpeed)}
            onValueChange={(v) => onSpeedChange(Number(v) as PlaybackSpeed)}
          >
            {SPEED_OPTIONS.map(({ label, value }) => (
              <StyledRadioItem key={value} value={String(value)}>
                <DD.ItemIndicator>
                  <CheckIcon className="text-purple-700" />
                </DD.ItemIndicator>
                {label}
              </StyledRadioItem>
            ))}
          </DD.RadioGroup>
        </DDContent>
      </DD.Portal>
    </DD.Root>
  );
};

function formatTimestepTime(timestepIndex: number, intervalSeconds = 3600) {
  const totalSeconds = timestepIndex * intervalSeconds;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
