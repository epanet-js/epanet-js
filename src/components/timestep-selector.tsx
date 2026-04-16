import { useAtomValue } from "jotai";
import clsx from "clsx";
import * as Popover from "@radix-ui/react-popover";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "src/icons";
import { simulationStepAtom } from "src/state/simulation";
import { simulationDerivedAtom } from "src/state/derived-branch-state";
import { triggerStylesFor } from "./form/selector";
import { useEffect, useState } from "react";
import { useBreakpoint } from "src/hooks/use-breakpoint";
import { useChangeTimestep } from "src/commands/change-timestep";

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

type ChangeTimestepSource = "buttons" | "dropdown";

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
  const canGoPrevious = currentTimestepIndex > 0;
  const canGoNext = currentTimestepIndex < timestepCount - 1;

  return (
    <div className="absolute top-3 right-3 flex items-center gap-1 p-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-black rounded-sm shadow-sm">
      <button
        onClick={() => onChangeTimestep(currentTimestepIndex - 1, "buttons")}
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
        onClick={() => onChangeTimestep(currentTimestepIndex + 1, "buttons")}
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
        onChangeTimestep={(index) => onChangeTimestep(index, "dropdown")}
      />
    </div>
  );
};

const ROW_HEIGHT = 32;
const LIST_MAX_HEIGHT = 240;

type TimestepDropdownProps = {
  currentTimestepIndex: number;
  timestepCount: number;
  reportTimestep: number;
  onChangeTimestep: (index: number) => void;
};

const TimestepDropdown = ({
  currentTimestepIndex,
  timestepCount,
  reportTimestep,
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
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
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
