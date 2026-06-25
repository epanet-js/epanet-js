import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { AssetType } from "@epanet-js/hydraulic-model";
import { useUserTracking } from "src/infra/user-tracking";
import { dialogAtom } from "src/state/dialog";

export const useShowCustomAttributes = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();

  const showCustomAttributes = useCallback(
    ({
      source,
      initialAssetType,
    }: {
      source: "toolbar";
      initialAssetType?: AssetType;
    }) => {
      userTracking.capture({
        name: "customAttributes.opened",
        source,
      });
      setDialogState({
        type: "customAttributes",
        initialAssetType,
      });
    },
    [setDialogState, userTracking],
  );

  return showCustomAttributes;
};
