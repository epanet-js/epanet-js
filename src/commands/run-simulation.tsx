import { useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { buildInp } from "src/simulation/build-inp";
import { dialogAtom } from "src/state/dialog";
import {
  stagingModelDerivedAtom,
  simulationDerivedAtom,
  simulationSettingsDerivedAtom,
  simulationSourceIdDerivedAtom,
} from "src/state/derived-branch-state";
import { branchStateAtom } from "src/state/branch-state";
import { projectSettingsAtom } from "src/state/project-settings";
import { simulationStepAtom } from "src/state/simulation";
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
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { nanoid } from "src/lib/id";
export const runSimulationShortcut = "shift+enter";

export const useRunSimulation = () => {
  const setSimulationState = useSetAtom(simulationDerivedAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const setSimulationStep = useSetAtom(simulationStepAtom);
  const isWaterAgeOn = useFeatureFlag("FLAG_WATER_AGE");
  const isWaterTraceOn = useFeatureFlag("FLAG_WATER_TRACE");
  const isWaterChemicalOn = useFeatureFlag("FLAG_WATER_CHEMICAL");

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
        const hydraulicModel = get(stagingModelDerivedAtom);
        const simulationSettings = get(simulationSettingsDerivedAtom);
        const worktree = get(worktreeAtom);
        const projectSettings = get(projectSettingsAtom);

        const currentSimulation = get(simulationDerivedAtom);
        setSimulationState({ ...currentSimulation, status: "running" });
        const inp = buildInp(hydraulicModel, {
          customerDemands: true,
          usedPatterns: true,
          usedCurves: true,
          includeQuality:
            (isWaterAgeOn &&
              simulationSettings.qualitySimulationType === "age") ||
            (isWaterChemicalOn &&
              simulationSettings.qualitySimulationType === "chemical"),
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
        const scenarioKey = worktree.activeBranchId;
        const runId = nanoid();
        const previousReader =
          "epsResultsReader" in currentSimulation
            ? currentSimulation.epsResultsReader
            : undefined;
        const previousSourceId = get(simulationSourceIdDerivedAtom);
        const runQuality =
          (isWaterAgeOn &&
            simulationSettings.qualitySimulationType === "age") ||
          (isWaterTraceOn &&
            simulationSettings.qualitySimulationType === "trace") ||
          (isWaterChemicalOn &&
            simulationSettings.qualitySimulationType === "chemical");
        const { report, status, metadata } = await runSimulationWorker(
          inp,
          appId,
          reportProgress,
          { runQuality },
          scenarioKey,
          runId,
        );

        isCompleted = true;

        let epsReader: EPSResultsReader | undefined = undefined;

        if (status === "success" || status === "warning") {
          const storage = new OPFSStorage(appId, scenarioKey, runId);
          epsReader = new EPSResultsReader(storage);
          await epsReader.initialize(metadata);
          setSimulationStep(0);
        } else {
          setSimulationStep(0);
        }

        if (status === "success" || status === "warning") {
          const newSimulationHasWaterAge =
            isWaterAgeOn && simulationSettings.qualitySimulationType === "age";
          if (!newSimulationHasWaterAge) {
            set(clearQuickGraphPropertyAtom, "waterAge");
            set(clearSymbologyForPropertyAtom, "waterAge");
          }
          const newSimulationHasWaterTrace =
            isWaterTraceOn &&
            simulationSettings.qualitySimulationType === "trace";
          if (!newSimulationHasWaterTrace) {
            set(clearQuickGraphPropertyAtom, "waterTrace");
            set(clearSymbologyForPropertyAtom, "waterTrace");
          }
          const newSimulationHasChemical =
            isWaterChemicalOn &&
            simulationSettings.qualitySimulationType === "chemical";
          if (!newSimulationHasChemical) {
            set(clearQuickGraphPropertyAtom, "chemicalConcentration");
            set(clearSymbologyForPropertyAtom, "chemicalConcentration");
          }
        }

        const simulationState = {
          status,
          report,
          modelVersion: hydraulicModel.version,
          settingsVersion: simulationSettings.version,
          epsResultsReader: epsReader,
        };
        setSimulationState(simulationState);
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
          qualityType: epsReader?.qualityType ?? "none",
          onContinue: options?.onContinue,
          onIgnore: options?.onIgnore,
          ignoreLabel: options?.ignoreLabel,
        });
      },
      [
        isWaterAgeOn,
        isWaterTraceOn,
        isWaterChemicalOn,
        setSimulationState,
        setDialogState,
        setSimulationStep,
      ],
    ),
  );

  return runSimulation;
};
