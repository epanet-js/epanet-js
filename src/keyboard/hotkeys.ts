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

    Mousetrap.bind(localizedKeys, fn);
    return () => {
      Mousetrap.unbind(localizedKeys);
    };
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencyList, dialog]);
};
