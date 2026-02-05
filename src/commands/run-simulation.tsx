import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { buildInp } from "src/simulation/build-inp";
import {
  dialogAtom,
  simulationAtom,
  simulationResultsAtom,
  stagingModelAtom,
} from "src/state/jotai";
import {
  ProgressCallback,
  runSimulation as runSimulationWorker,
  EPSResultsReader,
} from "src/simulation";
import { useDrawingMode } from "./set-drawing-mode";
import { Mode } from "src/state/mode";
import { getAppId } from "src/infra/app-instance";
import { OPFSStorage } from "src/infra/storage";
import { worktreeAtom } from "src/state/scenarios";
import { usePersistenceWithSnapshots } from "src/lib/persistence";

export const runSimulationShortcut = "shift+enter";

export const useRunSimulation = () => {
  const setSimulationState = useSetAtom(simulationAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const setDrawingMode = useDrawingMode();
  const worktree = useAtomValue(worktreeAtom);
  const persistence = usePersistenceWithSnapshots();
  const setSimulationResults = useSetAtom(simulationResultsAtom);

  const runSimulation = useCallback(
    async (options?: {
      onContinue?: () => void;
      onIgnore?: () => void;
      ignoreLabel?: string;
    }) => {
      setDrawingMode(Mode.NONE);
      setSimulationState((prev) => ({ ...prev, status: "running" }));
      const inp = buildInp(hydraulicModel, {
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
      const scenarioKey = worktree.activeSnapshotId;
      const { report, status, metadata } = await runSimulationWorker(
        inp,
        appId,
        reportProgress,
        {},
        scenarioKey,
      );

      isCompleted = true;

      let simulationIds;
      if (status === "success" || status === "warning") {
        const storage = new OPFSStorage(appId, scenarioKey);
        const epsReader = new EPSResultsReader(storage);
        await epsReader.initialize(metadata);
        simulationIds = epsReader.simulationIds;
        const resultsReader = await epsReader.getResultsForTimestep(0);
        setSimulationResults(resultsReader);
      } else {
        setSimulationResults(null);
      }

      const simulationResult = {
        status,
        report,
        modelVersion: hydraulicModel.version,
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
        onIgnore: options?.onIgnore,
        ignoreLabel: options?.ignoreLabel,
      });
    },
    [
      setDrawingMode,
      hydraulicModel,
      setSimulationState,
      setSimulationResults,
      setDialogState,
      worktree.activeSnapshotId,
      persistence,
    ],
  );

  return runSimulation;
};
