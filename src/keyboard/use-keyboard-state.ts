import { useRef } from "react";
import { useHotkeysDeprecated } from "./hotkeys";

export function useKeyboardState() {
  const shiftHeld = useRef<boolean>(false);
  const spaceHeld = useRef<boolean>(false);
  const controlHeld = useRef<boolean>(false);

  useHotkeysDeprecated(
    "shift",
    (e) => {
      shiftHeld.current = e.shiftKey;
    },
    { keydown: true, keyup: true },
    [],
  );

  useHotkeysDeprecated(
    "Space",
    (e) => {
      spaceHeld.current = e.type === "keydown";
    },
    { keydown: true, keyup: true },
    [],
  );

  useHotkeysDeprecated(
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
