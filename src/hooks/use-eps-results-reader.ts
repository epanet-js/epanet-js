import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { getAppId } from "src/infra/app-instance";
import { OPFSStorage } from "src/infra/storage/opfs-storage";
import { EPSResultsReader } from "src/simulation/epanet/eps-results-reader";
import { worktreeAtom } from "src/state/scenarios";
import { simulationAtom } from "src/state/simulation";

export const useGetEpsResultsReader = () => {
  const simulation = useAtomValue(simulationAtom);
  const worktree = useAtomValue(worktreeAtom);

  return useCallback(async (): Promise<EPSResultsReader | null> => {
    if (simulation.status !== "success" && simulation.status !== "warning") {
      return null;
    }
    if (!simulation.metadata) return null;

    const storage = new OPFSStorage(getAppId(), worktree.activeSnapshotId);
    const epsReader = new EPSResultsReader(storage);
    await epsReader.initialize(simulation.metadata, simulation.simulationIds);
    return epsReader;
  }, [simulation, worktree.activeSnapshotId]);
};
