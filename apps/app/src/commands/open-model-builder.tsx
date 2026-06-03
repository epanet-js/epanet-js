import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { useEarlyAccess } from "src/hooks/use-early-access";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const useOpenModelBuilder = () => {
  const userTracking = useUserTracking();
  const setDialogState = useSetAtom(dialogAtom);
  const onlyEarlyAccess = useEarlyAccess();
  const isBuildV2On = useFeatureFlag("FLAG_BUILD_V2");

  const openModelBuilder = useCallback(
    ({ source }: { source: string }) => {
      const dialogType = isBuildV2On
        ? "modelBuilderV2Iframe"
        : "modelBuilderIframe";

      onlyEarlyAccess(() => {
        userTracking.capture({
          name: "modelBuilder.opened",
          source,
        });

        setDialogState({ type: dialogType });
      }, dialogType);
    },
    [userTracking, setDialogState, onlyEarlyAccess, isBuildV2On],
  );

  return openModelBuilder;
};
