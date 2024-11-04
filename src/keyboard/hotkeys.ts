import Mousetrap from "mousetrap";
import { useEffect } from "react";
import { useHotkeys as rawUseHotkeys } from "react-hotkeys-hook";
import { isDebugOn } from "src/infra/debug-mode";
import { addToErrorLog } from "src/infra/error-tracking";

type Params = Parameters<typeof rawUseHotkeys>;

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

export function useHotkeysDeprecated(
  keys: Params[0],
  fn: Params[1],
  a: Params[2],
  b?: Params[3],
) {
  const wrap: Params[1] = (...args) => {
    const message = typeof keys === "string" ? keys : keys.join(",");
    addToErrorLog({
      category: "keyboardshortcut",
      message,
      level: "info",
    });
    if (isDebugOn) {
      // eslint-disable-next-line
    console.log("HOTKEYS_CALL", keys, a, b);
    }
    return fn(...args);
  };

  if (isDebugOn) {
    // eslint-disable-next-line
    console.log("HOTKEYS_REGISTER", keys, a, b);
  }
  return rawUseHotkeys(keys, wrap, a, b);
}
