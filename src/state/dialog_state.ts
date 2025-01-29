import { atomWithReset } from "jotai/utils";
import type { FileGroups } from "src/lib/group_files";

/**
 * Modal state, controlled by dragging and dropping,
 * keybindings, etc.
 */
export type DialogStateImport = {
  type: "import";
  files: FileGroups;
};

export type OpenInpDialogState = {
  type: "openInp";
  files: FileGroups;
};

export type DialogStateExamples = {
  type: "import_example";
};

export type DialogState =
  | DialogStateImport
  | OpenInpDialogState
  | {
      type: "cheatsheet";
    }
  | {
      type: "unsavedChanges";
    }
  | null;

export const dialogAtom = atomWithReset<DialogState>(null);
