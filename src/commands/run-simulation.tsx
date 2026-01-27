import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { buildInp } from "src/simulation/build-inp";
import { buildInpWithCustomerDemands } from "src/simulation/build-inp-with-customer-demands";
import { dataAtom, dialogAtom, simulationAtom } from "src/state/jotai";
import {
  ProgressCallback,
  runSimulation as runSimulationWorker,
  EPSResultsReader,
} from "src/simulation";
import { attachSimulation } from "src/hydraulic-model";
import { useDrawingMode } from "./set-drawing-mode";
import { Mode } from "src/state/mode";
import { getAppId } from "src/infra/app-instance";
import { OPFSStorage } from "src/infra/storage";
import { worktreeAtom } from "src/state/scenarios";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { usePersistence } from "src/lib/persistence/context";
import type { MemPersistence } from "src/lib/persistence/memory";

export const runSimulationShortcut = "shift+enter";

export const useRunSimulation = () => {
  const setSimulationState = useSetAtom(simulationAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const { hydraulicModel } = useAtomValue(dataAtom);
  const setData = useSetAtom(dataAtom);
  const setDrawingMode = useDrawingMode();
  const worktree = useAtomValue(worktreeAtom);
  const isScenariosOn = useFeatureFlag("FLAG_SCENARIOS");
  const isCustomerDemandsOn = useFeatureFlag("FLAG_CUSTOMER_DEMANDS");
  const persistence = usePersistence() as MemPersistence;

  const runSimulation = useCallback(
    async (options?: { onContinue?: () => void }) => {
      setDrawingMode(Mode.NONE);
      setSimulationState((prev) => ({ ...prev, status: "running" }));
      const buildInpFn = isCustomerDemandsOn
        ? buildInpWithCustomerDemands
        : buildInp;
      const inp = buildInpFn(hydraulicModel, {
        customerDemands: true,
        usedPatterns: true,
      });
      const start = performance.now();

      let isCompleted = false;

      setDialogState({
        type: "simulationProgress",
        currentTime: 0,
        totalDuration: 0,
      });

      const reportProgress: ProgressCallback = (progress) => {
        if (isCompleted) return;
        setDialogState({
          type: "simulationProgress",
          ...progress,
        });
      };

      const appId = getAppId();
      const scenarioKey = isScenariosOn ? worktree.activeSnapshotId : undefined;
      const { report, status, metadata } = await runSimulationWorker(
        inp,
        appId,
        reportProgress,
        {},
        scenarioKey,
      );

      isCompleted = true;

      let updatedHydraulicModel = hydraulicModel;
      let simulationIds;
      if (status === "success" || status === "warning") {
        const storage = new OPFSStorage(appId, scenarioKey);
        const epsReader = new EPSResultsReader(storage);
        await epsReader.initialize(metadata);
        simulationIds = epsReader.simulationIds;
        const resultsReader = await epsReader.getResultsForTimestep(0);
        updatedHydraulicModel = attachSimulation(hydraulicModel, resultsReader);
        setData((prev) => ({
          ...prev,
          hydraulicModel: updatedHydraulicModel,
        }));
      }

      const simulationResult = {
        status,
        report,
        modelVersion: updatedHydraulicModel.version,
        metadata,
        simulationIds,
        currentTimestepIndex: 0,
      };
      setSimulationState(simulationResult);
      persistence.syncSnapshotSimulation(simulationResult);
      const end = performance.now();
      const duration = end - start;

      if (options?.onContinue && status === "success") {
        setDialogState(null);
        options.onContinue();
        return;
      }

      setDialogState({
        type: "simulationSummary",
        status,
        duration,
        onContinue: options?.onContinue,
      });
    },
    [
      setDrawingMode,
      hydraulicModel,
      setSimulationState,
      setDialogState,
      setData,
      isScenariosOn,
      isCustomerDemandsOn,
      worktree.activeSnapshotId,
      persistence,
    ],
  );

  return runSimulation;
};
