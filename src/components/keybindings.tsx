import { useMapKeybindings } from "src/hooks/use_map_keybindings";
import { useHotkeys } from "src/keyboard/hotkeys";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/jotai";

export function Keybindings() {
  const setDialogState = useSetAtom(dialogAtom);

  useMapKeybindings();

  useHotkeys(
    ["shift+/"],
    (e) => {
      // Don't type a / in the input.
      e.preventDefault();
      setDialogState((modalState) => {
        if (modalState) return modalState;
        return {
          type: "cheatsheet",
        };
      });
    },
    [setDialogState],
    "CHEATSHEET",
  );

  return null;
}
