import { useAtomValue } from "jotai";
import { hasUnsavedChangesRevisionAtom } from "src/state/project-revision";

export const useHasUnsavedChanges = (): boolean =>
  useAtomValue(hasUnsavedChangesRevisionAtom);
