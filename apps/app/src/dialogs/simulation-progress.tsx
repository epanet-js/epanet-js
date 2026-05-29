import * as Progress from "@radix-ui/react-progress";
import { useState } from "react";
import { SimulationProgressDialogState } from "src/state/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { cancelSimulation } from "src/simulation/epanet/main";
import { Button } from "src/components/elements";
import { BaseDialog } from "../components/dialog";

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
};

const ProgressBar = ({
  label,
  currentTime,
  totalDuration,
  isIndeterminate = false,
}: {
  label: string;
  currentTime: number;
  totalDuration: number;
  isIndeterminate?: boolean;
}) => {
  const progressPercent =
    totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div>
      <div className="flex flex-row items-baseline gap-1 mb-2">
        <p className="text-size-base text-subtle">{label}</p>
        {!isIndeterminate && (
          <p className="text-size-base font-bold text-default tabular-nums">
            {formatTime(currentTime)}
          </p>
        )}
      </div>
      <Progress.Root
        className="relative overflow-hidden bg-base-active rounded-full w-full h-2"
        value={isIndeterminate ? null : currentTime}
        max={totalDuration}
      >
        {isIndeterminate ? (
          <Progress.Indicator className="bg-accent h-full w-1/4 rounded-full progress-indeterminate" />
        ) : (
          <Progress.Indicator
            className="bg-accent w-full h-full"
            style={{
              transform: `translateX(-${100 - progressPercent}%)`,
            }}
          />
        )}
      </Progress.Root>
    </div>
  );
};

export const SimulationProgressDialog = ({
  modal,
}: {
  modal: SimulationProgressDialogState;
}) => {
  const translate = useTranslate();
  const [stopping, setStopping] = useState(false);
  const { currentTime, totalDuration, phase } = modal;

  const label =
    phase === "finalizing"
      ? translate("savingResults")
      : phase === "quality"
        ? translate("runningQualityAnalysis")
        : translate("runningHydraulicAnalysis");

  const handleStop = () => {
    setStopping(true);
    cancelSimulation();
  };

  return (
    <BaseDialog size="sm" isOpen={true} onClose={() => {}} preventClose={true}>
      <div className="p-6 flex flex-col gap-4">
        <ProgressBar
          label={label}
          currentTime={currentTime}
          totalDuration={totalDuration}
          isIndeterminate={phase === "finalizing"}
        />
        <div className="flex justify-center">
          <Button
            variant="default"
            size="sm"
            disabled={stopping}
            onClick={handleStop}
          >
            {stopping
              ? translate("stoppingSimulation")
              : translate("stopSimulation")}
          </Button>
        </div>
      </div>
    </BaseDialog>
  );
};
