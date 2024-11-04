import { useHotkeys as rawUseHotkeys } from "react-hotkeys-hook";
import { isDebugOn } from "src/infra/debug-mode";
import { addToErrorLog } from "src/infra/error-tracking";

type Params = Parameters<typeof rawUseHotkeys>;

export function useHotkeys(
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
