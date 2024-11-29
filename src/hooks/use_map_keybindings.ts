import type { Options } from "react-hotkeys-hook";
import { useHotkeys } from "src/keyboard/hotkeys";
import {
  Mode,
  dataAtom,
  ephemeralStateAtom,
  modeAtom,
  selectionAtom,
} from "src/state/jotai";
import { usePersistence } from "src/lib/persistence/context";
import { filterLockedFeatures } from "src/lib/folder";
import { USelection } from "src/selection";
import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import { deleteAssets } from "src/hydraulic-model";
import { useSetAtom } from "jotai";

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
  const historyControl = rep.useHistoryControl();
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const setMode = useSetAtom(modeAtom);
  const transact = rep.useTransact();

  useHotkeys(
    ["command+z", "ctrl+z"],
    () => {
      historyControl("undo");
      setEphemeralState({ type: "none" });
      setMode({ mode: Mode.NONE });
    },
    [historyControl],
    "UNDO",
  );

  useHotkeys(
    ["command+y", "ctrl+y"],
    (e) => {
      historyControl("redo");
      setEphemeralState({ type: "none" });
      setMode({ mode: Mode.NONE });
      e.preventDefault();
    },
    [historyControl],
    "REDO",
  );

  const onSelectAll = useAtomCallback(
    useCallback((get, set) => {
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

        const moment = deleteAssets(hydraulicModel, {
          assetIds: USelection.toIds(selection),
        });

        transact(moment);
        return false;
      },
      [transact],
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
