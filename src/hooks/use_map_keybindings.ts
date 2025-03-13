import type { Options } from "react-hotkeys-hook";
import { useHotkeys } from "src/keyboard/hotkeys";
import { dataAtom, selectionAtom } from "src/state/jotai";
import { filterLockedFeatures } from "src/lib/folder";
import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import { useUserTracking } from "src/infra/user-tracking";

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
  const userTracking = useUserTracking();

  const onSelectAll = useAtomCallback(
    useCallback(
      (get, set) => {
        userTracking.capture({
          name: "fullSelection.enabled",
          source: "shortcut",
        });
        const data = get(dataAtom);
        set(selectionAtom, {
          type: "multi",
          ids: filterLockedFeatures(data).map((f) => f.id),
        });
      },
      [userTracking],
    ),
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
}
