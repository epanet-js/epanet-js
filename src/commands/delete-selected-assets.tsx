import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { Asset } from "src/hydraulic-model";
import { deleteAssets } from "src/hydraulic-model/model-operations";
import { AssetDeleted, useUserTracking } from "src/infra/user-tracking";
import { usePersistence } from "src/lib/persistence";
import { USelection } from "src/selection";
import {
  selectionAtom,
  ephemeralStateAtom,
  modeAtom,
  Mode,
  stagingModelAtom,
} from "src/state/jotai";

export const deleteSelectedShortcuts = ["backspace", "del"];

export const useDeleteSelectedAssets = () => {
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const [selection, setSelection] = useAtom(selectionAtom);
  const setMode = useSetAtom(modeAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const rep = usePersistence();
  const transact = rep.useTransact();
  const userTracking = useUserTracking();

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

      const moment = deleteAssets(hydraulicModel, {
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
    ],
  );

  return deleteSelectedAssets;
};
