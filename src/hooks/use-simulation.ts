import { useAtomValue } from "jotai";
import { simulationResultsAtom } from "src/state/jotai";

export const useSimulation = () => {
  return useAtomValue(simulationResultsAtom);
};
