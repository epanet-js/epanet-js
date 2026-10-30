import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { useEarlyAccess } from "src/hooks/use-early-access";
import { usePermissions } from "src/hooks/use-permissions";
import { useStartBlankProject } from "src/hooks/persistence/use-start-new-project";
import { useUnsavedChangesCheck } from "./check-unsaved-changes";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { contentViewAtom } from "src/state/content-view";

const buildModelBuildViewUrl = (): string => {
  const url = new URL(window.location.href);
  url.searchParams.set("view", "modelBuild");
  return url.toString();
};

export const useOpenModelBuilder = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const { canUseModelBuildV2 } = usePermissions();
  const isLimitedModelBuildOn = useFeatureFlag("FLAG_LIMITED_MODEL_BUILD");
  const openNewModelBuilder = useOpenNewModelBuilder();

  const openModelBuilder = useCallback(
    ({ source }: { source: string }) => {
      if (!canUseModelBuildV2 && !isLimitedModelBuildOn) {
        setDialogState({ type: "modelBuilderPaywall", source });
        return;
      }

      openNewModelBuilder({ source });
    },
    [
      setDialogState,
      canUseModelBuildV2,
      isLimitedModelBuildOn,
      openNewModelBuilder,
    ],
  );

  return openModelBuilder;
};

const useOpenNewModelBuilder = () => {
  const userTracking = useUserTracking();
  const setDialogState = useSetAtom(dialogAtom);
  const onlyEarlyAccess = useEarlyAccess();
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const startBlankProject = useStartBlankProject();
  const setContentView = useSetAtom(contentViewAtom);
  const isModelBuildFullViewOn = useFeatureFlag("FLAG_MODEL_BUILD_FULL_VIEW");

  const openNewModelBuilder = useCallback(
    ({ source }: { source: string }) => {
      onlyEarlyAccess(() => {
        checkUnsavedChanges(async () => {
          userTracking.capture({
            name: "modelBuilder.opened",
            source,
          });

          const started = await startBlankProject();
          if (!started) return;

          if (isModelBuildFullViewOn) {
            setDialogState(null);
            setContentView({ type: "modelBuild", step: null });
          } else {
            setDialogState({ type: "modelBuilderV2Iframe" });
          }
        });
      }, buildModelBuildViewUrl());
    },
    [
      userTracking,
      setDialogState,
      onlyEarlyAccess,
      checkUnsavedChanges,
      startBlankProject,
      setContentView,
      isModelBuildFullViewOn,
    ],
  );

  return openNewModelBuilder;
};
