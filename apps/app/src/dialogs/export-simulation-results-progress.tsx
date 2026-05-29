import { useRef } from "react";
import * as Progress from "@radix-ui/react-progress";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { SuccessIcon } from "src/icons";
import type { ExportSimulationResultsProperties } from "src/lib/export/types";

export const ExportSimulationResultsProgressDialog = ({
  progress,
  currentProperty,
  isComplete,
  onCancel,
  onClose,
}: {
  progress: number;
  currentProperty: ExportSimulationResultsProperties | null;
  isComplete: boolean;
  onCancel: () => void;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const highWaterMark = useRef(0);
  if (progress > highWaterMark.current) highWaterMark.current = progress;
  const displayProgress = highWaterMark.current;

  const isSaving = displayProgress >= 100 && !isComplete;
  const percentText = translate(
    "exportTimeSeries.inProgress",
    String(Math.trunc(displayProgress)),
  );
  const propertyText = (() => {
    if (!currentProperty || isComplete || isSaving) return null;
    return translate(
      "exportTimeSeries.inProgressWithProperty",
      translate(
        currentProperty === "waterQuality"
          ? "simulationSettings.waterQuality"
          : currentProperty,
      ).toLocaleLowerCase(),
    );
  })();
  const statusText = (() => {
    if (isComplete) return translate("exportTimeSeries.complete");
    if (isSaving) return translate("exportTimeSeries.savingFiles");
    if (!propertyText) return percentText;
    return null;
  })();

  return (
    <BaseDialog
      title={translate("exportTimeSeries.progress")}
      size="sm"
      isOpen={true}
      onClose={isComplete ? onClose : onCancel}
      preventClose={!isComplete}
      footer={
        isComplete ? (
          <SimpleDialogActions
            secondary={{ action: translate("ok"), onClick: onClose }}
          />
        ) : (
          <SimpleDialogActions
            secondary={{
              action: translate("dialog.cancel"),
              onClick: onCancel,
            }}
          />
        )
      }
    >
      <div className="p-4 space-y-2">
        <p className="tabular-nums text-size-base text-default flex items-center gap-1.5">
          {isComplete && <SuccessIcon className="text-green-600 shrink-0" />}
          {propertyText ? (
            <>
              <span>{propertyText}</span>
              <span className="ml-auto">{percentText}</span>
            </>
          ) : (
            statusText
          )}
        </p>
        {!isComplete && (
          <Progress.Root
            className="relative overflow-hidden bg-base-active rounded-full w-full h-2"
            value={isSaving ? undefined : displayProgress}
            max={100}
          >
            {isSaving ? (
              <Progress.Indicator className="bg-accent-hover h-full w-1/4 rounded-full progress-indeterminate" />
            ) : (
              <Progress.Indicator
                className="bg-accent-hover w-full h-full transition-all duration-150"
                style={{
                  transform: `translateX(-${100 - displayProgress}%)`,
                }}
              />
            )}
          </Progress.Root>
        )}
      </div>
    </BaseDialog>
  );
};
