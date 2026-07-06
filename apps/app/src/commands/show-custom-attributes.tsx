import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { usePermissions } from "src/hooks/use-permissions";
import { dialogAtom } from "src/state/dialog";
import type { CustomAttributeAssetType } from "@epanet-js/custom-attributes";

export const useShowCustomAttributes = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();
  const { canUseCustomAttributes } = usePermissions();

  const showCustomAttributes = useCallback(
    ({
      source,
      initialAssetType,
    }: {
      source: "toolbar";
      initialAssetType?: CustomAttributeAssetType;
    }) => {
      userTracking.capture({
        name: "customAttributes.opened",
        source,
        canUseCustomAttributes,
      });

      if (!canUseCustomAttributes) {
        setDialogState({ type: "featurePaywall", feature: "customAttributes" });
        return;
      }

      setDialogState({
        type: "customAttributes",
        initialAssetType,
      });
    },
    [setDialogState, userTracking, canUseCustomAttributes],
  );

  return showCustomAttributes;
};
