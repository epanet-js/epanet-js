import { useAtomValue } from "jotai";
import Mousetrap from "mousetrap";
import { useEffect } from "react";
import { isDebugOn } from "src/infra/debug-mode";
import { getIsMac } from "src/lib/utils";
import { dialogAtom } from "src/state/dialog_state";

type DependencyList = ReadonlyArray<unknown>;

export const useHotkeys = (
  keys: string | string[],
  fn: (e: Event) => void,
  dependencyList: DependencyList,
  label: string,
) => {
  const keysList = Array.isArray(keys) ? keys : [keys];
  const localizedKeys = keysList.map(translateCommandForMac);
  const dialog = useAtomValue(dialogAtom);

  useEffect(() => {
    if (isDebugOn) {
      // eslint-disable-next-line no-console
      console.log(
        `HOTKEYS_BIND binding to ${JSON.stringify(localizedKeys)} operation ${label}`,
      );
    }

    if (!!dialog) return;

    Mousetrap.bind(localizedKeys, fn);
    return () => {
      Mousetrap.unbind(localizedKeys);
    };
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencyList, dialog]);
};

const translateCommandForMac = (hotkey: string): string => {
  if (!getIsMac()) return hotkey;

  return hotkey.replace("ctrl", "command");
};
