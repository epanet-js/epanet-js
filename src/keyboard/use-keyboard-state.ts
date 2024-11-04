import { isHotkeyPressed } from "react-hotkeys-hook";

export function useKeyboardState() {
  const isControlHeld = () =>
    isHotkeyPressed("ctrl") || isHotkeyPressed("meta"); //command
  const isSpaceHeld = () => isHotkeyPressed("space");
  const isShiftHeld = () => isHotkeyPressed("shift");

  return {
    isShiftHeld,
    isSpaceHeld,
    isControlHeld,
  };
}
