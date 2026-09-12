import { useEffect, useRef } from "react";
import { useAtom, useSetAtom } from "jotai";
import { BaseDialog, useDialogState } from "src/components/dialog";
import {
  trialAfterSignInAtom,
  useActivateTrial,
} from "src/hooks/use-activate-trial";
import { useAuth } from "src/hooks/use-auth";
import { isTrialAvailable } from "src/lib/account-plans";
import { dialogAtom } from "src/state/dialog";
import { RefreshIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";

export const ActivateTrialAfterSignIn = () => {
  const { isSignedIn, user } = useAuth();
  const [isPending, setPending] = useAtom(trialAfterSignInAtom);
  const setDialog = useSetAtom(dialogAtom);

  useEffect(() => {
    if (!isPending || !isSignedIn || user.id === null) return;

    setPending(false);
    setDialog({ type: "activatingTrial" });
  }, [isPending, isSignedIn, user.id, setPending, setDialog]);

  return null;
};

export const ActivatingTrialDialog = () => {
  const { activateTrial } = useActivateTrial();
  const { isLoaded, isSignedIn, user } = useAuth();
  const { closeDialog } = useDialogState();
  const translate = useTranslate();
  const activatedRef = useRef(false);

  const isUserReady = isLoaded && (!isSignedIn || user.id !== null);

  if (!activatedRef.current && isUserReady) {
    activatedRef.current = true;

    if (!isSignedIn || !isTrialAvailable(user)) {
      closeDialog();
    } else {
      void activateTrial().then(() => {
        closeDialog();
      });
    }
  }

  return (
    <BaseDialog
      size="xs"
      isOpen={true}
      onClose={closeDialog}
      preventClose={true}
    >
      <div className="flex flex-col items-center gap-3 p-6">
        <RefreshIcon className="animate-spin w-6 h-6 text-subtle" />
        <p className="text-size-base text-default">
          {translate("trial.activating")}
        </p>
      </div>
    </BaseDialog>
  );
};
