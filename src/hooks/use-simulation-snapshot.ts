import { useAtomValue } from "jotai";
import { simulationSnapshotAtom } from "src/state/jotai";

export const useSimulationSnapshot = () => {
  return useAtomValue(simulationSnapshotAtom);
};
