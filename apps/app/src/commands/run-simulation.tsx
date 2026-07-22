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
import { opfsAvailableAtom } from "src/state/opfs";
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
import { nanoid } from "src/lib/id";
import { useUserTracking } from "src/infra/user-tracking";
import { useToggleNetworkReview } from "src/commands/toggle-network-review";
import { validateModelAttributes } from "src/lib/model-attributes-validation";
import {
  modelAttributesValidationIssuesAtom,
  selectedReviewCheckAtom,
} from "src/state/network-review";
import { CheckType } from "src/panels/network-review/common";
export const runSimulationShortcut = "shift+enter";

export const useRunSimulation = () => {
  const setSimulationState = useSetAtom(simulationDerivedAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const setSimulationStep = useSetAtom(simulationStepAtom);
  const userTracking = useUserTracking();
  const toggleNetworkReview = useToggleNetworkReview();

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
        if (!get(opfsAvailableAtom)) return;

        const hydraulicModel = get(stagingModelDerivedAtom);
        const simulationSettings = get(simulationSettingsDerivedAtom);
        const worktree = get(worktreeAtom);
        const projectSettings = get(projectSettingsAtom);

        const run = async () => {
          const currentSimulation = get(simulationDerivedAtom);
          setSimulationState({ ...currentSimulation, status: "running" });
          const inp = buildInp(hydraulicModel, {
            customerDemands: true,
            usedPatterns: true,
            usedCurves: true,
            includeQuality:
              simulationSettings.qualitySimulationType === "age" ||
              simulationSettings.qualitySimulationType === "chemical",
            simulationSettings,
            units: projectSettings.units,
            headlossFormula: projectSettings.headlossFormula,
            excludeInactiveControls: true,
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
            simulationSettings.qualitySimulationType !== "none";
          const { report, status, metadata, errorKind } =
            await runSimulationWorker(
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
            if (simulationSettings.qualitySimulationType !== "age") {
              set(clearQuickGraphPropertyAtom, "waterAge");
              set(clearSymbologyForPropertyAtom, "waterAge");
            }
            if (simulationSettings.qualitySimulationType !== "trace") {
              set(clearQuickGraphPropertyAtom, "waterTrace");
              set(clearSymbologyForPropertyAtom, "waterTrace");
            }
            if (simulationSettings.qualitySimulationType !== "chemical") {
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

          if (status === "failure" && errorKind === "oom") {
            setDialogState({ type: "simulationOutOfMemory" });
            return;
          }

          setDialogState({
            type: "simulationSummary",
            status: status,
            duration,
            qualityType: epsReader?.qualityType ?? "none",
            onContinue: options?.onContinue,
            onIgnore: options?.onIgnore,
            ignoreLabel: options?.ignoreLabel,
          });
        };

        const runWithIssues = () => {
          setDialogState(null);
          userTracking.capture({
            name: "simulation.validation.resolved",
            choice: "runAnyway",
          });
          void run();
        };

        const reviewIssues = () => {
          setDialogState(null);
          userTracking.capture({
            name: "simulation.validation.resolved",
            choice: "fixFirst",
          });
          set(selectedReviewCheckAtom, CheckType.modelAttributesValidation);
          toggleNetworkReview({ source: "auto", state: true });
        };

        const issues = await validateModelAttributes(hydraulicModel);
        set(modelAttributesValidationIssuesAtom, issues);
        if (issues.length > 0) {
          userTracking.capture({
            name: "simulation.validation.issuesFound",
            issueCount: issues.length,
            rules: [...new Set(issues.map((issue) => issue.ruleId))],
          });
          setDialogState({
            type: "modelAttributesValidation",
            issueCount: issues.length,
            onFixFirst: reviewIssues,
            onRunAnyway: runWithIssues,
          });
          return;
        }

        await run();
      },
      [
        setSimulationState,
        setDialogState,
        setSimulationStep,
        userTracking,
        toggleNetworkReview,
      ],
    ),
  );

  return runSimulation;
};
