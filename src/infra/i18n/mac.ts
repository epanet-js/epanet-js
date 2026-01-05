import once from "lodash/once";

export const cmdSymbol = "⌘";
export const macShiftSymbol = "⇧";
export const optionSymbol = "⌥";
export const backspaceSymbol = "⌫";
export const deleteSymbol = "⌦";
export const leftArrowSymbol = "←";
export const rightArrowSymbol = "→";

export function localizeKeybinding(
  keys: string,
  isMac: boolean = getIsMac(),
): string {
  return keys
    .toUpperCase()
    .replace("ENTER", "Enter")
    .replace("SHIFT", isMac ? macShiftSymbol : "Shift")
    .replace("ESC", "Esc")
    .replace("BACKSPACE", backspaceSymbol)
    .replace("COMMAND", isMac ? cmdSymbol : "Ctrl")
    .replace("CTRL", isMac ? cmdSymbol : "Ctrl")
    .replace("ALT", isMac ? optionSymbol : "Alt")
    .replace("LEFT", leftArrowSymbol)
    .replace("RIGHT", rightArrowSymbol)
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
