import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { EPSResultsReader } from "src/simulation";
import type { EPSSimulationResult } from "src/simulation/epanet/worker";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import { OPFSStorage } from "src/infra/storage";
import { branchStateAtom } from "src/state/branch-state";
import { simulationSourceIdDerivedAtom } from "src/state/derived-branch-state";
import { clearQuickGraphPropertyAtom } from "src/state/quick-graph";
import type { SimulationRunLocation } from "src/state/simulation";
import { commitSimulationResultAtom } from "src/state/simulation-step";

export type SimulationRunToRecord = {
  status: EPSSimulationResult["status"];
  report: string;
  metadata: ArrayBuffer;
  location: SimulationRunLocation;
  modelVersion: string;
  simulationSettings: SimulationSettings;
  previousReader: EPSResultsReader | undefined;
  previousSourceId: string;
};

export const useRecordSimulationRun = () => {
  return useAtomCallback(
    useCallback(
      async (
        get,
        set,
        {
          status,
          report,
          metadata,
          location,
          modelVersion,
          simulationSettings,
          previousReader,
          previousSourceId,
        }: SimulationRunToRecord,
      ): Promise<EPSResultsReader | undefined> => {
        const { appId, scenarioKey, runId } = location;
        let epsReader: EPSResultsReader | undefined = undefined;

        if (status === "success" || status === "warning") {
          const storage = new OPFSStorage(appId, scenarioKey, runId);
          epsReader = new EPSResultsReader(storage);
          await epsReader.initialize(metadata);
        }

        if (status === "success" || status === "warning") {
          if (simulationSettings.qualitySimulationType !== "age") {
            set(clearQuickGraphPropertyAtom, "waterAge");
          }
          if (simulationSettings.qualitySimulationType !== "trace") {
            set(clearQuickGraphPropertyAtom, "waterTrace");
          }
          if (simulationSettings.qualitySimulationType !== "chemical") {
            set(clearQuickGraphPropertyAtom, "chemicalConcentration");
          }
        }

        set(commitSimulationResultAtom, {
          status,
          report,
          modelVersion,
          settingsVersion: simulationSettings.version,
          epsResultsReader: epsReader,
          runLocation: epsReader ? { appId, scenarioKey, runId } : undefined,
        });
        set(simulationSourceIdDerivedAtom, scenarioKey);

        if (
          previousReader &&
          previousReader !== epsReader &&
          previousSourceId === scenarioKey
        ) {
          const branchStates = get(branchStateAtom);
          const stillDependedOn = Array.from(branchStates.entries()).some(
            ([id, state]) =>
              id !== scenarioKey && state.simulationSourceId === scenarioKey,
          );
          if (!stillDependedOn) {
            void previousReader.dispose().catch(() => {});
          }
        }

        return epsReader;
      },
      [],
    ),
  );
};
