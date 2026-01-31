import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { buildInp } from "src/simulation/build-inp";
import {
  dialogAtom,
  simulationAtom,
  simulationResultsAtom,
  stagingModelAtom,
  simulationCacheAtom,
} from "src/state/jotai";
import {
  ProgressCallback,
  runSimulation as runSimulationWorker,
  EPSResultsReader,
} from "src/simulation";
import { buildSimulationKey } from "src/simulation/simulation-key";
import { attachSimulation } from "src/hydraulic-model";
import { useDrawingMode } from "./set-drawing-mode";
import { Mode } from "src/state/mode";
import { getAppId } from "src/infra/app-instance";
import { OPFSStorage } from "src/infra/storage";
import { worktreeAtom } from "src/state/scenarios";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { usePersistenceWithSnapshots } from "src/lib/persistence";

export const runSimulationShortcut = "shift+enter";

export const useRunSimulation = () => {
  const setSimulationState = useSetAtom(simulationAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const setHydraulicModel = useSetAtom(stagingModelAtom);
  const setDrawingMode = useDrawingMode();
  const worktree = useAtomValue(worktreeAtom);
  const isScenariosOn = useFeatureFlag("FLAG_SCENARIOS");
  const isSimulationLoose = useFeatureFlag("FLAG_SIMULATION_LOOSE");
  const persistence = usePersistenceWithSnapshots();
  const setSimulationResults = useSetAtom(simulationResultsAtom);
  const setSimulationCache = useSetAtom(simulationCacheAtom);

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
      const scenarioKey = isScenariosOn ? worktree.activeSnapshotId : undefined;
      const storageKey = isSimulationLoose
        ? buildSimulationKey(hydraulicModel.version)
        : scenarioKey;
      const { report, status, metadata } = await runSimulationWorker(
        inp,
        appId,
        reportProgress,
        {},
        storageKey,
      );

      isCompleted = true;

      let updatedHydraulicModel = hydraulicModel;
      let simulationIds;
      if (status === "success" || status === "warning") {
        const storage = new OPFSStorage(appId, storageKey);
        const epsReader = new EPSResultsReader(storage);
        await epsReader.initialize(metadata);
        simulationIds = epsReader.simulationIds;
        const resultsReader = await epsReader.getResultsForTimestep(0);
        setSimulationResults(resultsReader);
        updatedHydraulicModel = attachSimulation(hydraulicModel, resultsReader);
        setHydraulicModel(updatedHydraulicModel);
      } else {
        setSimulationResults(null);
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

      if (isSimulationLoose && (status === "success" || status === "warning")) {
        setSimulationCache((prev) => {
          const next = new Map(prev);
          next.set(updatedHydraulicModel.version, simulationResult);
          return next;
        });
      }
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
      setSimulationCache,
      setDialogState,
      setHydraulicModel,
      isScenariosOn,
      isSimulationLoose,
      worktree.activeSnapshotId,
      persistence,
    ],
  );

  return runSimulation;
};
