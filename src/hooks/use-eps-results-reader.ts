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

  const status = simulation.status;
  const metadata =
    status === "success" || status === "warning"
      ? simulation.metadata
      : undefined;
  const simulationIds =
    status === "success" || status === "warning"
      ? simulation.simulationIds
      : undefined;
  const activeSnapshotId = worktree.activeSnapshotId;

  return useCallback(async (): Promise<EPSResultsReader | null> => {
    if (status !== "success" && status !== "warning") {
      return null;
    }
    if (!metadata) return null;

    const storage = new OPFSStorage(getAppId(), activeSnapshotId);
    const epsReader = new EPSResultsReader(storage);
    await epsReader.initialize(metadata, simulationIds);
    return epsReader;
  }, [status, metadata, simulationIds, activeSnapshotId]);
};
