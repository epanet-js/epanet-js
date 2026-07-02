import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { dialogAtom } from "src/state/dialog";
import type { CustomAttributeAssetType } from "@epanet-js/custom-attributes";

export const useShowCustomAttributesInAsset = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();

  const showCustomAttributesInAsset = useCallback(
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
      });
      setDialogState({
        type: "customAttributesInAsset",
        initialAssetType,
      });
    },
    [setDialogState, userTracking],
  );

  return showCustomAttributesInAsset;
};
