import { useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";

export function useKeyboardState() {
  const shiftHeld = useRef<boolean>(false);
  const spaceHeld = useRef<boolean>(false);
  const controlHeld = useRef<boolean>(false);

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

  useHotkeys(
    "meta, Ctrl",
    (e) => {
      controlHeld.current = e.ctrlKey || e.metaKey;
    },
    { keydown: true, keyup: true },
    [],
  );

  const isControlHeld = () => controlHeld.current;
  const isSpaceHeld = () => spaceHeld.current;
  const isShiftHeld = () => shiftHeld.current;

  return {
    isShiftHeld,
    isSpaceHeld,
    isControlHeld,
  };
}
