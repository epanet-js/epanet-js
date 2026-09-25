import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { useAuth } from "src/hooks/use-auth";
import { useScenarioOperations } from "src/hooks/use-scenario-operations";
import { isAuthEnabled } from "src/global-config";
import { dialogAtom } from "src/state/dialog";
import { worktreeAtom } from "src/state/scenarios";

export const useSwitchToBranch = () => {
  const { isSignedIn, isLoaded } = useAuth();
  const setDialog = useSetAtom(dialogAtom);
  const { switchToBranch } = useScenarioOperations();

  return useAtomCallback(
    useCallback(
      (get, _set, branchId: string) => {
        const isScenario = branchId !== get(worktreeAtom).mainId;
        if (isScenario && isAuthEnabled && !isSignedIn) {
          if (isLoaded) setDialog({ type: "scenarioSignIn" });
          return;
        }
        switchToBranch(branchId);
      },
      [isSignedIn, isLoaded, setDialog, switchToBranch],
    ),
  );
};
