import Mousetrap from "mousetrap";
import { useEffect } from "react";
import { isDebugOn } from "src/infra/debug-mode";

type DependencyList = ReadonlyArray<unknown>;

export const useHotkeys = (
  keys: string | string[],
  fn: (e: Event) => void,
  dependencyList: DependencyList,
  label: string,
) => {
  useEffect(() => {
    if (isDebugOn) {
      // eslint-disable-next-line no-console
      console.log(
        `HOTKEYS_BIND binding to ${JSON.stringify(keys)} operation ${label}`,
      );
    }

    Mousetrap.bind(keys, fn);
    return () => {
      Mousetrap.unbind(keys);
    };
  }, dependencyList);
};
