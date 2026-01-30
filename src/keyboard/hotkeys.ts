import { useAtomValue } from "jotai";
import Mousetrap from "mousetrap";
import { useEffect } from "react";
import { isDebugOn } from "src/infra/debug-mode";
import { dialogAtom } from "src/state/dialog";
import { getIsMac } from "src/infra/i18n/mac";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

type DependencyList = ReadonlyArray<unknown>;

export const useHotkeys = (
  keys: string | string[],
  fn: (e: Event) => void,
  dependencyList: DependencyList,
  label: string,
  disabled = false,
) => {
  const isMac = useFeatureFlag("FLAG_MAC");
  const keysList = Array.isArray(keys) ? keys : [keys];
  const localizedKeys = keysList.map((hotkey) =>
    isMac || getIsMac() ? hotkey.replace("ctrl", "command") : hotkey,
  );
  const dialog = useAtomValue(dialogAtom);

  useEffect(() => {
    if (isDebugOn) {
      // eslint-disable-next-line no-console
      console.log(
        `HOTKEYS_BIND binding to ${JSON.stringify(localizedKeys)} operation ${label}`,
      );
    }

    if (!!dialog) return;

    // Wrap the callback to check if the event was already handled
    const wrappedFn = (e: Event) => {
      // Skip if event was already handled (e.g., by a data grid or other component)
      if (e.defaultPrevented) return;
      fn(e);
    };

    if (disabled === false) Mousetrap.bind(localizedKeys, wrappedFn);
    return () => {
      Mousetrap.unbind(localizedKeys);
    };
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencyList, dialog, disabled]);
};
