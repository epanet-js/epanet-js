import { useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { buildInp } from "src/simulation/build-inp";
import { dialogAtom } from "src/state/dialog";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { projectSettingsAtom } from "src/state/project-settings";
import { simulationAtom, simulationStepAtom } from "src/state/simulation";
import { simulationSettingsAtom } from "src/state/simulation-settings";
import { clearQuickGraphPropertyAtom } from "src/state/quick-graph";
import { clearSymbologyForPropertyAtom } from "src/state/map-symbology";
import {
  ProgressCallback,
  runSimulation as runSimulationWorker,
  EPSResultsReader,
} from "src/simulation";
import { getAppId } from "src/infra/app-instance";
import { OPFSStorage } from "src/infra/storage";
import { worktreeAtom } from "src/state/scenarios";
import { usePersistenceWithSnapshots } from "src/lib/persistence";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
export const runSimulationShortcut = "shift+enter";

export const useRunSimulation = () => {
  const setSimulationState = useSetAtom(simulationAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const persistence = usePersistenceWithSnapshots();
  const setSimulationStep = useSetAtom(simulationStepAtom);
  const isWaterAgeOn = useFeatureFlag("FLAG_WATER_AGE");

  const runSimulation = useAtomCallback(
    useCallback(
      async (
        get,
        set,
        options?: {
          onContinue?: () => void;
          onIgnore?: () => void;
          ignoreLabel?: string;
        },
      ) => {
        const hydraulicModel = get(stagingModelAtom);
        const simulationSettings = get(simulationSettingsAtom);
        const worktree = get(worktreeAtom);
        const projectSettings = get(projectSettingsAtom);

        setSimulationState((prev) => ({ ...prev, status: "running" }));
        const inp = buildInp(hydraulicModel, {
          customerDemands: true,
          usedPatterns: true,
          usedCurves: true,
          includeQuality:
            isWaterAgeOn && simulationSettings.qualitySimulationType === "AGE",
          simulationSettings,
          units: projectSettings.units,
          headlossFormula: projectSettings.headlossFormula,
        });
        const start = performance.now();

        let isCompleted = false;

        setDialogState({
          type: "simulationProgress",
          currentTime: 0,
          totalDuration: 0,
          phase: "hydraulic",
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
        const runQuality =
          isWaterAgeOn && simulationSettings.qualitySimulationType === "AGE";
        const { report, status, metadata } = await runSimulationWorker(
          inp,
          appId,
          reportProgress,
          { runQuality },
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
          setSimulationStep({ resultsReader, currentTimestepIndex: 0 });
        } else {
          setSimulationStep(null);
        }

        if (status === "success" || status === "warning") {
          const newSimulationHasWaterAge =
            isWaterAgeOn && simulationSettings.qualitySimulationType === "AGE";
          if (!newSimulationHasWaterAge) {
            set(clearQuickGraphPropertyAtom, "waterAge");
            set(clearSymbologyForPropertyAtom, "waterAge");
          }
        }

        const simulationResult = {
          status,
          report,
          modelVersion: hydraulicModel.version,
          settingsVersion: simulationSettings.version,
          metadata,
          simulationIds,
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
        setSimulationState,
        setDialogState,
        persistence,
        setSimulationStep,
        isWaterAgeOn,
      ],
    ),
  );

  return runSimulation;
};
