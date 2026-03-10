import { useAtomValue } from "jotai";
import { simulationResultsAtom } from "src/state/simulation";

export const useSimulation = () => {
  return useAtomValue(simulationResultsAtom);
};
