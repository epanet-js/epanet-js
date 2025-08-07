import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { modelBuilderUrl } from "src/global-config";

export const useOpenModelBuilder = () => {
  const userTracking = useUserTracking();
  const isModelBuildIframeOn = useFeatureFlag("FLAG_MODEL_BUILD_IFRAME");
  const setDialogState = useSetAtom(dialogAtom);

  const openModelBuilder = useCallback(
    ({ source }: { source: string }) => {
      userTracking.capture({
        name: "modelBuilder.opened",
        source,
      });

      if (isModelBuildIframeOn) {
        setDialogState({ type: "modelBuilderIframe" });
      } else {
        window.open(modelBuilderUrl, "_blank");
      }
    },
    [userTracking, isModelBuildIframeOn, setDialogState],
  );

  return openModelBuilder;
};
