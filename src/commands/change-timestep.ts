import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { dataAtom, simulationAtom } from "src/state/jotai";
import { attachSimulation } from "src/hydraulic-model";
import { OPFSStorage } from "src/infra/storage/opfs-storage";
import { EPSResultsReader } from "src/simulation/epanet/eps-results-reader";
import { getAppId } from "src/infra/app-instance";
import { captureError } from "src/infra/error-tracking";
import { useUserTracking } from "src/infra/user-tracking";

type ChangeTimestepSource = "previous" | "next" | "dropdown";

export const useChangeTimestep = () => {
  const simulation = useAtomValue(simulationAtom);
  const setData = useSetAtom(dataAtom);
  const setSimulationState = useSetAtom(simulationAtom);
  const userTracking = useUserTracking();

  const changeTimestep = useCallback(
    async (timestepIndex: number, source: ChangeTimestepSource) => {
      if (simulation.status !== "success" && simulation.status !== "warning") {
        return;
      }

      const { metadata, simulationIds } = simulation;
      if (!metadata) {
        return;
      }

      try {
        const appId = getAppId();
        const storage = new OPFSStorage(appId);
        const epsReader = new EPSResultsReader(storage);
        await epsReader.initialize(metadata, simulationIds);

        const resultsReader =
          await epsReader.getResultsForTimestep(timestepIndex);

        setData((prev) => ({
          ...prev,
          hydraulicModel: attachSimulation(prev.hydraulicModel, resultsReader),
        }));

        setSimulationState((prev) => ({
          ...prev,
          currentTimestepIndex: timestepIndex,
        }));

        userTracking.capture({
          name: "simulation.timestep.changed",
          timestepIndex,
          source,
        });
      } catch (error) {
        captureError(error as Error);
      }
    },
    [simulation, setData, setSimulationState, userTracking],
  );

  return { changeTimestep };
};
