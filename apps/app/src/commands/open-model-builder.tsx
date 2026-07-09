import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { useEarlyAccess } from "src/hooks/use-early-access";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { usePermissions } from "src/hooks/use-permissions";
import { useStartBlankProject } from "src/hooks/persistence/use-start-new-project";
import { useUnsavedChangesCheck } from "./check-unsaved-changes";

export const useOpenModelBuilder = () => {
  const userTracking = useUserTracking();
  const setDialogState = useSetAtom(dialogAtom);
  const onlyEarlyAccess = useEarlyAccess();
  const isBuildV2On = useFeatureFlag("FLAG_BUILD_V2");
  const { canUseModelBuildV2 } = usePermissions();
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const startBlankProject = useStartBlankProject();

  const openModelBuilder = useCallback(
    ({ source }: { source: string }) => {
      if (isBuildV2On && !canUseModelBuildV2) {
        setDialogState({ type: "modelBuilderPaywall", source });
        return;
      }

      const dialogType = isBuildV2On
        ? "modelBuilderV2Iframe"
        : "modelBuilderIframe";

      onlyEarlyAccess(() => {
        checkUnsavedChanges(async () => {
          userTracking.capture({
            name: "modelBuilder.opened",
            source,
          });

          await startBlankProject();
          setDialogState({ type: dialogType });
        });
      }, dialogType);
    },
    [
      userTracking,
      setDialogState,
      onlyEarlyAccess,
      isBuildV2On,
      canUseModelBuildV2,
      checkUnsavedChanges,
      startBlankProject,
    ],
  );

  return openModelBuilder;
};
