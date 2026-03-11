import { useRef } from "react";
import {
  DialogContainer,
  BaseModal,
  useDialogState,
} from "src/components/dialog";
import { useActivateTrial } from "src/hooks/use-activate-trial";
import { useAuth } from "src/auth";
import { isTrialActive } from "src/user-plan";
import { notify } from "src/components/notifications";
import { RefreshIcon, SuccessIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const ActivatingTrialDialog = () => {
  const isModalsOn = useFeatureFlag("FLAG_MODALS");
  const { activateTrial } = useActivateTrial();
  const { user } = useAuth();
  const { closeDialog } = useDialogState();
  const translate = useTranslate();
  const activatedRef = useRef(false);

  if (!activatedRef.current) {
    activatedRef.current = true;

    if (isTrialActive(user)) {
      closeDialog();
    } else {
      void activateTrial().then((success) => {
        if (success) {
          notify({
            variant: "success",
            title: translate("trial.activated"),
            Icon: SuccessIcon,
            duration: 3000,
          });
        }
        closeDialog();
      });
    }
  }

  if (isModalsOn) {
    return (
      <BaseModal
        size="xs"
        isOpen={true}
        onClose={closeDialog}
        preventClose={true}
      >
        <div className="flex flex-col items-center gap-3 p-6">
          <RefreshIcon className="animate-spin w-6 h-6 text-gray-500" />
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {translate("trial.activating")}
          </p>
        </div>
      </BaseModal>
    );
  }

  return (
    <DialogContainer size="xs">
      <div className="flex flex-col items-center gap-3 py-4">
        <RefreshIcon className="animate-spin w-6 h-6 text-gray-500" />
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {translate("trial.activating")}
        </p>
      </div>
    </DialogContainer>
  );
};
