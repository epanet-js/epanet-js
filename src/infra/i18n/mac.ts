import once from "lodash/once";

export const cmdSymbol = "⌘";
export const macShiftSymbol = "⇧";

export function localizeKeybinding(
  keys: string,
  isMac: boolean = getIsMac(),
): string {
  return keys
    .toUpperCase()
    .replace("ENTER", "Enter")
    .replace("SHIFT", isMac ? macShiftSymbol : "Shift")
    .replace("ESC", "Esc")
    .replace("COMMAND", isMac ? cmdSymbol : "Ctrl")
    .replace("CTRL", isMac ? cmdSymbol : "Ctrl")
    .replace(`${cmdSymbol}+`, cmdSymbol)
    .replace(`${macShiftSymbol}+`, macShiftSymbol)
    .replace(`${cmdSymbol}${macShiftSymbol}`, `${macShiftSymbol}${cmdSymbol}`);
}

const getIsMac = once((): boolean => {
  try {
    return /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform);
  } catch (e) {
    return false;
  }
});
