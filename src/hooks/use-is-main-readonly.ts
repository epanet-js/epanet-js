import { useAtomValue } from "jotai";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { scenariosAtom } from "src/state/scenarios";

export const useIsMainReadonly = () => {
  const isScenariosOn = useFeatureFlag("FLAG_SCENARIOS");
  const scenariosState = useAtomValue(scenariosAtom);

  return (
    isScenariosOn &&
    scenariosState.scenarios.size > 0 &&
    scenariosState.activeScenarioId === null
  );
};
