import { useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";

export function useKeyboardState() {
  const shiftHeld = useRef<boolean>(false);
  const spaceHeld = useRef<boolean>(false);

  useHotkeys(
    "*",
    (e) => {
      shiftHeld.current = e.shiftKey;
    },
    { keydown: true, keyup: true },
    [],
  );

  useHotkeys(
    "Space",
    (e) => {
      spaceHeld.current = e.type === "keydown";
    },
    { keydown: true, keyup: true },
    [],
  );

  return { isShiftHeld: shiftHeld.current, isSpaceHeld: spaceHeld.current };
}
