import { useAtomValue } from "jotai";
import {
  hasUnsavedChangesRevisionAtom,
  hasUnsavedChangesRevisionDeprecatedAtom,
} from "src/state/project-revision";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const useHasUnsavedChanges = (): boolean => {
  const isPersistScenariosOn = useFeatureFlag("FLAG_PERSIST_SCENARIOS");
  const hasUnsavedChanges = useAtomValue(hasUnsavedChangesRevisionAtom);
  const hasUnsavedChangesDeprecated = useAtomValue(
    hasUnsavedChangesRevisionDeprecatedAtom,
  );

  return isPersistScenariosOn ? hasUnsavedChanges : hasUnsavedChangesDeprecated;
};
