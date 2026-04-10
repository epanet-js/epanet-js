import * as Progress from "@radix-ui/react-progress";
import { SimulationProgressDialogState } from "src/state/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { BaseDialog } from "../components/dialog";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

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
        <p className="text-sm text-gray-500">{label}</p>
        {!isIndeterminate && (
          <p className="text-sm font-bold text-gray-900 tabular-nums">
            {formatTime(currentTime)}
          </p>
        )}
      </div>
      <Progress.Root
        className="relative overflow-hidden bg-gray-200 rounded-full w-full h-2"
        value={isIndeterminate ? null : currentTime}
        max={totalDuration}
      >
        {isIndeterminate ? (
          <Progress.Indicator className="bg-purple-500 h-full w-1/4 rounded-full progress-indeterminate" />
        ) : (
          <Progress.Indicator
            className="bg-purple-500 w-full h-full"
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
  const isWaterAgeOn = useFeatureFlag("FLAG_WATER_AGE");
  const isWaterTraceOn = useFeatureFlag("FLAG_WATER_TRACE");
  const { currentTime, totalDuration, phase } = modal;
  const isQualityOn = isWaterAgeOn || isWaterTraceOn;
  const dialogSize = isQualityOn ? "sm" : "xs";

  const label =
    phase === "finalizing"
      ? translate("savingResults")
      : !isQualityOn
        ? translate("runningSimulation")
        : phase === "quality"
          ? translate("runningQualityAnalysis")
          : translate("runningHydraulicAnalysis");

  return (
    <BaseDialog
      size={dialogSize}
      isOpen={true}
      onClose={() => {}}
      preventClose={true}
    >
      <div className="p-6">
        <ProgressBar
          label={label}
          currentTime={currentTime}
          totalDuration={totalDuration}
          isIndeterminate={phase === "finalizing"}
        />
      </div>
    </BaseDialog>
  );
};
