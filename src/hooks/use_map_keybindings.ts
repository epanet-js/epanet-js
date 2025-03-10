import type { Options } from "react-hotkeys-hook";
import { useHotkeys } from "src/keyboard/hotkeys";
import { dataAtom, selectionAtom } from "src/state/jotai";
import { usePersistence } from "src/lib/persistence/context";
import { filterLockedFeatures } from "src/lib/folder";
import { USelection } from "src/selection";
import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import { deleteAssets } from "src/hydraulic-model/model-operations";
import { useUserTracking } from "src/infra/user-tracking";
import { isFeatureOn } from "src/infra/feature-flags";

const IGNORE_ROLES = new Set(["menuitem"]);

export const keybindingOptions: Options = {
  enabled(e) {
    try {
      return !IGNORE_ROLES.has((e.target as HTMLElement).getAttribute("role")!);
    } catch (e) {
      return true;
    }
  },
};

export function useMapKeybindings() {
  const rep = usePersistence();
  const transact = rep.useTransact();
  const userTracking = useUserTracking();

  const onSelectAll = useAtomCallback(
    useCallback((get, set) => {
      if (isFeatureOn("FLAG_TRACKING")) {
        userTracking.capture({
          name: "fullSelection.enabled",
          source: "shortcut",
        });
      }
      const data = get(dataAtom);
      set(selectionAtom, {
        type: "multi",
        ids: filterLockedFeatures(data).map((f) => f.id),
      });
    }, []),
  );

  useHotkeys(
    ["command+a", "ctrl+a"],
    (e) => {
      e.preventDefault();
      void onSelectAll();
    },
    [onSelectAll],
    "SELECT_ALL",
  );

  const onDelete = useAtomCallback(
    useCallback(
      (get, set) => {
        const data = get(dataAtom);
        set(selectionAtom, USelection.none());
        const { hydraulicModel, selection } = data;

        const assetIds = USelection.toIds(selection);
        const moment = deleteAssets(hydraulicModel, {
          assetIds,
        });
        if (isFeatureOn("FLAG_TRACKING")) {
          userTracking.capture({
            name: "assets.deleted",
            source: "shortcut",
            count: assetIds.length,
          });
        }

        transact(moment);
        return false;
      },
      [transact, userTracking],
    ),
  );

  useHotkeys(
    ["backspace", "del"],
    (e) => {
      if (IGNORE_ROLES.has((e.target as HTMLElement).getAttribute("role")!))
        return;

      e.preventDefault();
      void onDelete();
    },
    [onDelete],
    "DELETE",
  );
}
