import once from "lodash/once";

export const cmdSymbol = "⌘";

export function localizeKeybinding(
  keys: string,
  isMac: boolean = getIsMac(),
): string {
  return keys
    .toUpperCase()
    .replace("ENTER", "Enter")
    .replace("SHIFT", "Shift")
    .replace("ESC", "Esc")
    .replace("COMMAND", isMac ? cmdSymbol : "Ctrl")
    .replace("CTRL", isMac ? cmdSymbol : "Ctrl")
    .replace(`${cmdSymbol}+`, cmdSymbol);
}

const getIsMac = once((): boolean => {
  try {
    return /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform);
  } catch (e) {
    return false;
  }
});
