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
        <p className="tabular-nums text-sm text-gray-700 flex items-center gap-1.5">
          {isComplete && <SuccessIcon className="text-green-600 shrink-0" />}
          {isComplete
            ? translate("exportTimeSeries.complete")
            : isSaving
              ? translate("exportTimeSeries.savingFiles")
              : translate(
                  "exportTimeSeries.inProgress",
                  String(Math.round(displayProgress)),
                  currentProperty ? translate(currentProperty) : "",
                )}
        </p>
        {!isComplete && (
          <Progress.Root
            className="relative overflow-hidden bg-gray-200 rounded-full w-full h-2"
            value={isSaving ? undefined : displayProgress}
            max={100}
          >
            {isSaving ? (
              <Progress.Indicator className="bg-purple-600 h-full w-1/4 rounded-full progress-indeterminate" />
            ) : (
              <Progress.Indicator
                className="bg-purple-600 w-full h-full transition-all duration-150"
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
