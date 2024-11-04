import { useMapKeybindings } from "src/hooks/use_map_keybindings";
import { useOpenFiles } from "src/hooks/use_open_files";
import { useHotkeys } from "src/keyboard/hotkeys";
import useFileSave from "src/hooks/use_file_save";
import { useSetAtom } from "jotai";
import { captureError } from "src/infra/error-tracking";
import { dialogAtom } from "src/state/jotai";
import toast from "react-hot-toast";

export function Keybindings() {
  const setDialogState = useSetAtom(dialogAtom);
  const saveNative = useFileSave();
  const openFiles = useOpenFiles();

  useMapKeybindings();

  useHotkeys(
    "/",
    (e) => {
      e.preventDefault();
      setDialogState({ type: "quickswitcher" });
    },
    [setDialogState],
    "QUICK SWITCH",
  );

  useHotkeys(
    ["command+k", "ctrl+k"],
    (e) => {
      e.preventDefault();
      setDialogState({ type: "quickswitcher" });
    },
    [setDialogState],
    "QUICK SWITCH",
  );

  useHotkeys(
    ["command+shift+s", "ctrl+shift+s"],
    (e) => {
      // Don't type a / in the input.
      e.preventDefault();
      setDialogState({
        type: "export",
      });
    },
    [setDialogState],
    "EXPORT",
  );

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

  useHotkeys(
    ["command+s", "ctrl+s"],
    (e) => {
      e.preventDefault();
      (async () => {
        const either = await saveNative();
        return either
          .ifLeft((error) => toast.error(error?.message || "Could not save"))
          .map((saved) => {
            if (saved) return;
            setDialogState({
              type: "export",
            });
          });
      })().catch((e) => captureError(e));
    },
    [setDialogState, saveNative],
    "SAVE",
  );

  useHotkeys(
    ["command+o", "ctrl+o"],
    (e) => {
      e.preventDefault();
      openFiles().catch((e) => captureError(e));
    },
    [openFiles],
    "OPEN",
  );

  return null;
}
