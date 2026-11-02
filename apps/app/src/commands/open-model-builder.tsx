import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { useEarlyAccess } from "src/hooks/use-early-access";
import { useStartBlankProject } from "src/hooks/persistence/use-start-new-project";
import { useUnsavedChangesCheck } from "./check-unsaved-changes";
import { contentViewAtom } from "src/state/content-view";

const buildModelBuildViewUrl = (): string => {
  const url = new URL(window.location.href);
  url.searchParams.set("view", "modelBuild");
  return url.toString();
};

export const useOpenModelBuilder = () => {
  const userTracking = useUserTracking();
  const setDialogState = useSetAtom(dialogAtom);
  const onlyEarlyAccess = useEarlyAccess();
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const startBlankProject = useStartBlankProject();
  const setContentView = useSetAtom(contentViewAtom);

  const openModelBuilder = useCallback(
    ({ source }: { source: string }) => {
      onlyEarlyAccess(() => {
        checkUnsavedChanges(async () => {
          userTracking.capture({
            name: "modelBuilder.opened",
            source,
          });

          const started = await startBlankProject();
          if (!started) return;

          setDialogState(null);
          setContentView({ type: "modelBuild", step: null });
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
    ],
  );

  return openModelBuilder;
};
