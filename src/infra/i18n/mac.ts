import once from "lodash/once";

export const cmdSymbol = "⌘";
export const macShiftSymbol = "⇧";
export const optionSymbol = "⌥";

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
    .replace("ALT", isMac ? optionSymbol : "Alt")
    .replace(`${cmdSymbol}+`, cmdSymbol)
    .replace(`${optionSymbol}+`, optionSymbol)
    .replace(`${macShiftSymbol}+`, macShiftSymbol)
    .replace(`${cmdSymbol}${macShiftSymbol}`, `${macShiftSymbol}${cmdSymbol}`);
}

export const getIsMac = once((): boolean => {
  try {
    return /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform);
  } catch (e) {
    return false;
  }
});
