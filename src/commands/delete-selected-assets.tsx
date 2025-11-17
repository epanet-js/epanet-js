import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { Asset } from "src/hydraulic-model";
import {
  deleteAssets,
  deleteAssetsWithActiveTopology,
} from "src/hydraulic-model/model-operations";
import { AssetDeleted, useUserTracking } from "src/infra/user-tracking";
import { usePersistence } from "src/lib/persistence/context";
import { USelection } from "src/selection";
import {
  dataAtom,
  selectionAtom,
  ephemeralStateAtom,
  modeAtom,
  Mode,
} from "src/state/jotai";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const deleteSelectedShortcuts = ["backspace", "del"];

export const useDeleteSelectedAssets = () => {
  const { hydraulicModel } = useAtomValue(dataAtom);
  const [selection, setSelection] = useAtom(selectionAtom);
  const setMode = useSetAtom(modeAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const rep = usePersistence();
  const transact = rep.useTransact();
  const userTracking = useUserTracking();
  const isActiveTopologyEnabled = useFeatureFlag("FLAG_ACTIVE_TOPOLOGY");

  const deleteSelectedAssets = useCallback(
    ({ source }: { source: AssetDeleted["source"] }) => {
      const assetIds = USelection.toIds(selection);
      if (!assetIds.length) return;

      setSelection(USelection.none());
      setMode({ mode: Mode.NONE });
      setEphemeralState({ type: "none" });

      if (assetIds.length === 1) {
        userTracking.capture({
          name: "asset.deleted",
          source,
          type: (hydraulicModel.assets.get(assetIds[0]) as Asset).type,
        });
      } else {
        userTracking.capture({
          name: "assets.deleted",
          source,
          count: assetIds.length,
        });
      }

      const moment = isActiveTopologyEnabled
        ? deleteAssetsWithActiveTopology(hydraulicModel, {
            assetIds,
            shouldUpdateCustomerPoints: true,
          })
        : deleteAssets(hydraulicModel, {
            assetIds,
            shouldUpdateCustomerPoints: true,
          });

      transact(moment);
    },
    [
      hydraulicModel,
      selection,
      transact,
      setSelection,
      setMode,
      setEphemeralState,
      userTracking,
      isActiveTopologyEnabled,
    ],
  );

  return deleteSelectedAssets;
};
