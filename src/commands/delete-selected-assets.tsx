import { useAtom, useAtomValue } from "jotai";
import { useCallback } from "react";
import { Asset } from "src/hydraulic-model";
import { deleteAssets } from "src/hydraulic-model/model-operations";
import { AssetDeleted, useUserTracking } from "src/infra/user-tracking";
import { usePersistence } from "src/lib/persistence/context";
import { USelection } from "src/selection";
import { dataAtom, selectionAtom } from "src/state/jotai";

export const deleteSelectedShortcuts = ["backspace", "del"];

export const useDeleteSelectedAssets = () => {
  const { hydraulicModel } = useAtomValue(dataAtom);
  const [selection, setSelection] = useAtom(selectionAtom);
  const rep = usePersistence();
  const transact = rep.useTransact();
  const userTracking = useUserTracking();

  const deleteSelectedAssets = useCallback(
    ({ source }: { source: AssetDeleted["source"] }) => {
      const assetIds = USelection.toIds(selection);
      if (!assetIds.length) return;

      setSelection(USelection.none());

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

      const moment = deleteAssets(hydraulicModel, {
        assetIds,
        shouldUpdateCustomerPoints: true,
      });

      transact(moment);
    },
    [hydraulicModel, selection, transact, setSelection, userTracking],
  );

  return deleteSelectedAssets;
};
