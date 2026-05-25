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
import { runPtsnetSimulation } from "src/simulation/ptsnet";
import { TransientResultsReader } from "src/simulation/ptsnet/transient-results-reader";
import { captureError } from "src/infra/error-tracking";
import { worktreeAtom } from "src/state/scenarios";
import type { HydraulicModel } from "src/hydraulic-model";

export const runSimulationShortcut = "shift+enter";

const findValveId = (
  hydraulicModel: HydraulicModel,
  label: string,
): number | undefined => {
  const wanted = label.trim().toLowerCase();
  if (!wanted) return undefined;
  for (const asset of hydraulicModel.assets.values()) {
    if (asset.type === "valve" && asset.label.trim().toLowerCase() === wanted) {
      return asset.id;
    }
  }
  return undefined;
};

export const useRunSimulation = () => {
  const setSimulationState = useSetAtom(simulationDerivedAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const setSimulationStep = useSetAtom(simulationStepAtom);

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
        const scenarioKey = worktree.activeBranchId;
        const previousReader =
          "epsResultsReader" in currentSimulation
            ? currentSimulation.epsResultsReader
            : undefined;
        const previousSourceId = get(simulationSourceIdDerivedAtom);

        const fail = (message: string) => {
          setSimulationStep(null);
          setSimulationState({
            status: "failure",
            report: message,
            modelVersion: hydraulicModel.version,
            settingsVersion: simulationSettings.version,
            epsResultsReader: undefined,
          });
          setDialogState({
            type: "simulationSummary",
            status: "failure",
            qualityType: "none",
            onContinue: options?.onContinue,
            onIgnore: options?.onIgnore,
            ignoreLabel: options?.ignoreLabel,
          });
        };

        if (!globalThis.crossOriginIsolated) {
          fail(
            "Transient simulation needs cross-origin isolation (SharedArrayBuffer), which isn't available in this browser.",
          );
          return;
        }

        const valveId = findValveId(
          hydraulicModel,
          simulationSettings.transientValveId,
        );
        if (valveId === undefined) {
          fail(
            `Valve "${simulationSettings.transientValveId}" was not found. Set a valid valve id in Simulation Settings → Transients.`,
          );
          return;
        }

        setSimulationState({ ...currentSimulation, status: "running" });

        const inp = buildInp(hydraulicModel, {
          customerDemands: true,
          usedPatterns: true,
          usedCurves: true,
          simulationSettings,
          units: projectSettings.units,
          headlossFormula: projectSettings.headlossFormula,
        });

        const duration = simulationSettings.transientDuration;
        const start = performance.now();
        let isCompleted = false;

        setDialogState({
          type: "simulationProgress",
          currentTime: 0,
          totalDuration: duration,
          phase: "hydraulic",
        });

        let raw;
        try {
          raw = await runPtsnetSimulation(
            {
              inp,
              valveName: String(valveId),
              settings: {
                duration,
                timeStep: simulationSettings.transientTimeStep,
                defaultWaveSpeed: simulationSettings.transientWaveSpeed,
              },
              operation: {
                finalSetting: simulationSettings.transientFinalSetting,
                startTime: simulationSettings.transientStartTime,
                endTime: simulationSettings.transientEndTime,
              },
            },
            ({ fraction }) => {
              if (isCompleted) return;
              setDialogState({
                type: "simulationProgress",
                currentTime: fraction * duration,
                totalDuration: duration,
                phase: "hydraulic",
              });
            },
          );
        } catch (error) {
          captureError(error as Error);
          fail(
            `Transient simulation failed: ${(error as Error).message ?? error}`,
          );
          return;
        }

        isCompleted = true;

        const reader = new TransientResultsReader(raw, projectSettings.units);
        setSimulationStep(0);

        setSimulationState({
          status: "success",
          report: "",
          modelVersion: hydraulicModel.version,
          settingsVersion: simulationSettings.version,
          epsResultsReader: reader,
        });
        set(simulationSourceIdDerivedAtom, scenarioKey);

        if (
          previousReader &&
          previousReader !== reader &&
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

        const duration_ms = performance.now() - start;

        if (options?.onContinue) {
          setDialogState(null);
          options.onContinue();
          return;
        }

        setDialogState({
          type: "simulationSummary",
          status: "success",
          duration: duration_ms,
          qualityType: "none",
          onContinue: options?.onContinue,
          onIgnore: options?.onIgnore,
          ignoreLabel: options?.ignoreLabel,
        });
      },
      [setSimulationState, setDialogState, setSimulationStep],
    ),
  );

  return runSimulation;
};
