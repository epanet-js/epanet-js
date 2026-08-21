import * as Progress from "@radix-ui/react-progress";
import type { RebuildPhase } from "src/lib/db";
import { RebuildStorageProgressDialogState } from "src/state/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { BaseDialog, SimpleDialogActions } from "../components/dialog";

const phaseTranslationKey = (phase: RebuildPhase): string => {
  switch (phase) {
    case "storage":
      return "rebuildStorageProgress.storage";
    case "writing":
      return "rebuildStorageProgress.writing";
    case "finalizing":
      return "rebuildStorageProgress.finalizing";
  }
};

const phasePercent = (phase: RebuildPhase): number => {
  switch (phase) {
    case "storage":
      return 10;
    case "writing":
      return 60;
    case "finalizing":
      return 100;
  }
};

export const RebuildStorageProgressDialog = ({
  modal,
  onClose,
}: {
  modal: RebuildStorageProgressDialogState;
  onClose: () => void;
}) => {
  const translate = useTranslate();

  if (modal.outcome === "memory") {
    return (
      <BaseDialog
        title={translate("rebuildStorageProgress.noBackupTitle")}
        size="sm"
        isOpen={true}
        onClose={onClose}
        footer={
          <SimpleDialogActions action={translate("gotIt")} onAction={onClose} />
        }
      >
        <div className="p-4 space-y-3">
          <p className="text-size-base text-default">
            {translate("noCrashRecoveryHint")}
          </p>
        </div>
      </BaseDialog>
    );
  }

  const label = translate(phaseTranslationKey(modal.phase));
  const percent = phasePercent(modal.phase);

  return (
    <BaseDialog size="sm" isOpen={true} onClose={() => {}} preventClose={true}>
      <div className="p-6 flex flex-col gap-4">
        <div>
          <p className="text-size-base text-subtle mb-2">{label}</p>
          <Progress.Root
            className="relative overflow-hidden bg-track rounded-full w-full h-2"
            value={percent}
            max={100}
          >
            <Progress.Indicator
              className="relative overflow-hidden bg-accent w-full h-full transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${100 - percent}%)` }}
            >
              <div className="absolute inset-y-0 left-0 w-1/3 progress-shimmer bg-linear-to-r from-transparent via-white/40 to-transparent" />
            </Progress.Indicator>
          </Progress.Root>
        </div>
      </div>
    </BaseDialog>
  );
};
