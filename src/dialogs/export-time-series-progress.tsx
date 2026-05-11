import * as Progress from "@radix-ui/react-progress";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { SuccessIcon } from "src/icons";

export const ExportTimeSeriesProgressDialog = ({
  progress,
  isComplete,
  onCancel,
  onClose,
}: {
  progress: number;
  isComplete: boolean;
  onCancel: () => void;
  onClose: () => void;
}) => {
  const translate = useTranslate();

  return (
    <BaseDialog
      title={translate("exportTimeSeries")}
      size="sm"
      isOpen={true}
      onClose={isComplete ? onClose : onCancel}
      preventClose={!isComplete}
      footer={
        isComplete ? (
          <SimpleDialogActions action={translate("ok")} onAction={onClose} />
        ) : (
          <SimpleDialogActions
            action={translate("dialog.cancel")}
            onAction={onCancel}
          />
        )
      }
    >
      <div className="p-4 space-y-2">
        <p className="text-sm text-gray-700 flex items-center gap-1.5">
          {isComplete && <SuccessIcon className="text-green-600 shrink-0" />}
          {isComplete
            ? translate("exportTimeSeries.complete")
            : translate(
                "exportTimeSeries.inProgress",
                String(Math.round(progress)),
              )}
        </p>
        {!isComplete && (
          <Progress.Root
            className="relative overflow-hidden bg-gray-200 rounded-full w-full h-2"
            value={isComplete ? 100 : progress}
            max={100}
          >
            <Progress.Indicator
              className="bg-purple-600 w-full h-full transition-all duration-150"
              style={{
                transform: `translateX(-${isComplete ? 0 : 100 - progress}%)`,
              }}
            />
          </Progress.Root>
        )}
      </div>
    </BaseDialog>
  );
};
