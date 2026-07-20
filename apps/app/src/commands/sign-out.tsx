import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { useAuth } from "src/hooks/use-auth";
import { useStartBlankProject } from "src/hooks/persistence/use-start-new-project";
import { SignOutStarted, useUserTracking } from "src/infra/user-tracking";
import { captureError } from "src/infra/error-tracking";
import { formatErrorDetails } from "src/lib/errors";
import { useUnsavedChangesCheck } from "./check-unsaved-changes";

export const useSignOut = () => {
  const { signOut } = useAuth();
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();
  const startBlankProject = useStartBlankProject();

  const signOutAndReset = useCallback(
    async ({ source }: { source: SignOutStarted["source"] }) => {
      userTracking.capture({ name: "signOut.started", source });
      setDialogState({ type: "loading" });

      try {
        await startBlankProject();
      } catch (error) {
        captureError(
          new Error(`signOut teardown failed: ${formatErrorDetails(error)}`, {
            cause: error,
          }),
        );
      }

      setDialogState({ type: "welcome" });
      await signOut();
    },
    [signOut, setDialogState, userTracking, startBlankProject],
  );

  return useCallback(
    ({ source }: { source: SignOutStarted["source"] }) => {
      checkUnsavedChanges(() => void signOutAndReset({ source }));
    },
    [checkUnsavedChanges, signOutAndReset],
  );
};
