import { useAtomValue } from "jotai";
import clsx from "clsx";
import { ChevronLeftIcon, ChevronRightIcon } from "src/icons";
import { simulationAtom } from "src/state/jotai";
import { Selector } from "./form/selector";
import { useMemo } from "react";
import { useBreakpoint } from "src/hooks/use-breakpoint";
import { useChangeTimestep } from "src/commands/change-timestep";
import {
  SimulationMetadata,
  PROLOG_SIZE,
  EPILOG_SIZE,
} from "src/simulation/epanet/simulation-metadata";

export const TimestepSelector = () => {
  const simulation = useAtomValue(simulationAtom);
  const { changeTimestep } = useChangeTimestep();
  const isSmOrLarger = useBreakpoint("sm");

  if (!isSmOrLarger) return null;
  if (simulation.status === "idle" || simulation.status === "running")
    return null;

  const { timestepCount, reportingTimeStep } = getSimulationMetadataValues(
    simulation.metadata,
  );
  const currentTimestepIndex = simulation.currentTimestepIndex ?? 0;

  if (timestepCount <= 1) return null;

  return (
    <TimestepSelectorUI
      currentTimestepIndex={currentTimestepIndex}
      timestepCount={timestepCount}
      reportTimestep={reportingTimeStep}
      onChangeTimestep={changeTimestep}
    />
  );
};

type ChangeTimestepSource = "previous" | "next" | "dropdown";

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

  const options = useMemo(() => {
    return Array.from({ length: timestepCount }, (_, i) => ({
      label: formatTimestepTime(i, reportTimestep),
      value: String(i),
    }));
  }, [timestepCount, reportTimestep]);

  return (
    <div className="absolute top-12 right-3 flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-black rounded-sm shadow-sm">
      <button
        onClick={() => onChangeTimestep(currentTimestepIndex - 1, "previous")}
        disabled={!canGoPrevious}
        className={clsx(
          "p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-l-sm",
          { "opacity-40 cursor-not-allowed": !canGoPrevious },
        )}
        aria-label="Previous timestep"
      >
        <ChevronLeftIcon />
      </button>
      <button
        onClick={() => onChangeTimestep(currentTimestepIndex + 1, "next")}
        disabled={!canGoNext}
        className={clsx("p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800", {
          "opacity-40 cursor-not-allowed": !canGoNext,
        })}
        aria-label="Next timestep"
      >
        <ChevronRightIcon />
      </button>
      <div className="border-l border-gray-300 dark:border-gray-700">
        <Selector
          options={options}
          selected={String(currentTimestepIndex)}
          onChange={(value) => onChangeTimestep(Number(value), "dropdown")}
          ariaLabel="Select timestep"
          styleOptions={{ border: false, paddingX: 2, paddingY: 1 }}
        />
      </div>
    </div>
  );
};

function getSimulationMetadataValues(metadata: ArrayBuffer | undefined): {
  timestepCount: number;
  reportingTimeStep: number;
} {
  if (!metadata || metadata.byteLength !== PROLOG_SIZE + EPILOG_SIZE) {
    return { timestepCount: 1, reportingTimeStep: 3600 };
  }
  const simMetadata = new SimulationMetadata(metadata);
  return {
    timestepCount: simMetadata.reportingPeriods,
    reportingTimeStep: simMetadata.reportingTimeStep,
  };
}

function formatTimestepTime(timestepIndex: number, intervalSeconds = 3600) {
  const totalSeconds = timestepIndex * intervalSeconds;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
