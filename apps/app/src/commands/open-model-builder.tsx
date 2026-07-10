import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { useEarlyAccess } from "src/hooks/use-early-access";
import { usePermissions } from "src/hooks/use-permissions";
import { useStartBlankProject } from "src/hooks/persistence/use-start-new-project";
import { useUnsavedChangesCheck } from "./check-unsaved-changes";

export const useOpenModelBuilder = () => {
  const userTracking = useUserTracking();
  const setDialogState = useSetAtom(dialogAtom);
  const onlyEarlyAccess = useEarlyAccess();
  const { canUseModelBuildV2 } = usePermissions();
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const startBlankProject = useStartBlankProject();

  const openModelBuilder = useCallback(
    ({ source }: { source: string }) => {
      if (!canUseModelBuildV2) {
        setDialogState({ type: "modelBuilderPaywall", source });
        return;
      }

      onlyEarlyAccess(() => {
        checkUnsavedChanges(async () => {
          userTracking.capture({
            name: "modelBuilder.opened",
            source,
          });

          await startBlankProject();
          setDialogState({ type: "modelBuilderV2Iframe" });
        });
      }, "modelBuilderV2Iframe");
    },
    [
      userTracking,
      setDialogState,
      onlyEarlyAccess,
      canUseModelBuildV2,
      checkUnsavedChanges,
      startBlankProject,
    ],
  );

  return openModelBuilder;
};
