import { useAtomValue } from "jotai";
import { simulationResultsDerivedAtom } from "src/state/derived-branch-state";

export const useSimulation = () => {
  return useAtomValue(simulationResultsDerivedAtom);
};
