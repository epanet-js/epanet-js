import once from "lodash/once";

export const cmdSymbol = "⌘";

export function localizeKeybinding(keys: string): string {
  return keys.replace("Command", getIsMac() ? cmdSymbol : "Ctrl");
}

const getIsMac = once((): boolean => {
  try {
    return /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform);
  } catch (e) {
    return false;
  }
});
