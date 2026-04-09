import { useAtomValue } from "jotai";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { simulationResultsDerivedAtom } from "src/state/derived-branch-state";
import { simulationResultsAtom } from "src/state/simulation";

export const useSimulation = () => {
  const isStateRefactorOn = useFeatureFlag("FLAG_STATE_REFACTOR");
  return useAtomValue(
    isStateRefactorOn ? simulationResultsDerivedAtom : simulationResultsAtom,
  );
};
