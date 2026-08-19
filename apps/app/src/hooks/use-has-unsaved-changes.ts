import { useAtomValue } from "jotai";
import { hasUnsavedChangesDerivedAtom } from "src/state/derived-branch-state";
import { hasUnsavedChangesRevisionAtom } from "src/state/project-revision";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const useHasUnsavedChanges = (): boolean => {
  const isDecoupleUnsavedOn = useFeatureFlag("FLAG_DECOUPLE_UNSAVED");
  const hasUnsavedChangesDeprecated = useAtomValue(
    hasUnsavedChangesDerivedAtom,
  );
  const hasUnsavedChanges = useAtomValue(hasUnsavedChangesRevisionAtom);

  return isDecoupleUnsavedOn ? hasUnsavedChanges : hasUnsavedChangesDeprecated;
};
