import * as Progress from "@radix-ui/react-progress";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { NotificationBanner } from "src/components/notifications";
import { useTranslate } from "src/hooks/use-translate";
import { UnavailableIcon } from "src/icons";
import { RecomputeElevationsProgressDialogState } from "src/state/dialog";

export const RecomputeElevationsProgressDialog = ({
  modal,
  onClose,
}: {
  modal: RecomputeElevationsProgressDialogState;
  onClose: () => void;
}) => {
  const translate = useTranslate();

  if (modal.error) {
    return (
      <BaseDialog
        title={translate("elevations.recompute.failedTitle")}
        size="sm"
        isOpen={true}
        onClose={onClose}
        footer={
          <SimpleDialogActions
            action={translate("understood")}
            onAction={onClose}
            autoFocusSubmit={true}
          />
        }
      >
        <div className="p-4 text-size-base">
          <NotificationBanner
            variant="error"
            Icon={UnavailableIcon}
            title={translate("elevations.recompute.failedTitle")}
            description={translate("elevations.recompute.failed")}
            className="border rounded-md"
          />
        </div>
      </BaseDialog>
    );
  }

  return (
    <BaseDialog size="sm" isOpen={true} onClose={() => {}} preventClose={true}>
      <div className="p-6 flex flex-col gap-4">
        <div>
          <p className="text-size-base text-subtle mb-2">
            {translate("elevations.recompute.running")}
          </p>
          <Progress.Root
            className="relative overflow-hidden bg-track rounded-full w-full h-2"
            value={null}
          >
            <Progress.Indicator className="bg-accent h-full w-1/4 rounded-full progress-indeterminate" />
          </Progress.Root>
        </div>
      </div>
    </BaseDialog>
  );
};
