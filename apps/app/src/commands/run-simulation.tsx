import { useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { useCallback, useRef } from "react";
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
import { opfsAvailableAtom } from "src/state/opfs";
import { commitSimulationResultAtom } from "src/state/simulation-step";
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
import { selectedReviewCheckAtom } from "src/state/network-review";
import { CheckType, failingRuleIds } from "src/lib/network-review";
import { useReviewChecks } from "src/hooks/use-review-checks";
import { errorName, handleError } from "src/infra/errors";
export const runSimulationShortcut = "shift+enter";

// Small models settle well inside this, so the dialog never flashes for them.
const progressDialogDelayMs = 300;

const aborted = Symbol("aborted");

export const useRunSimulation = () => {
  const setSimulationState = useSetAtom(simulationDerivedAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();
  const toggleNetworkReview = useToggleNetworkReview();
  const { ensureFresh } = useReviewChecks();
  const isCheckingRef = useRef(false);

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
          set(commitSimulationResultAtom, simulationState);
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

          if (status === "failure" && errorKind === "storage") {
            setDialogState({ type: "simulationStorageError" });
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

        const reviewChecks = (target: CheckType | "summary") => {
          setDialogState(null);
          userTracking.capture({
            name: "simulation.validation.resolved",
            choice: "fixFirst",
          });
          set(selectedReviewCheckAtom, target);
          toggleNetworkReview({ source: "auto", state: true });
        };

        if (isCheckingRef.current) return;
        isCheckingRef.current = true;

        const abortController = new AbortController();
        let hasSettled = false;

        const cancelChecks = () => {
          userTracking.capture({
            name: "simulation.validation.cancelled",
            at: "checking",
          });
          abortController.abort();
        };

        const dismiss = (at: "issuesFound" | "failed") => () => {
          userTracking.capture({
            name: "simulation.validation.cancelled",
            at,
          });
          setDialogState(null);
        };

        const showProgress = setTimeout(() => {
          if (hasSettled) return;
          setDialogState({
            type: "preSimulationChecks",
            status: "running",
            onReview: () => reviewChecks("summary"),
            onRunAnyway: runWithIssues,
            onCancel: cancelChecks,
          });
        }, progressDialogDelayMs);

        // Cancelling terminates the check workers, and a terminated Comlink
        // call never settles — so racing the signal is what actually ends the
        // wait, not the rejection.
        const cancelled = new Promise<typeof aborted>((resolve) => {
          abortController.signal.addEventListener("abort", () =>
            resolve(aborted),
          );
        });

        let results;
        try {
          results = await Promise.race([
            ensureFresh({ signal: abortController.signal }),
            cancelled,
          ]);
        } catch (error) {
          if (errorName(error) === "AbortError") {
            setDialogState(null);
            return;
          }

          handleError(error, {
            as: "pre-simulation checks failed",
            onUnexpected: "capture",
          });
          setDialogState({
            type: "preSimulationChecks",
            status: "failed",
            onReview: () => reviewChecks("summary"),
            onRunAnyway: runWithIssues,
            onCancel: dismiss("failed"),
          });
          return;
        } finally {
          hasSettled = true;
          clearTimeout(showProgress);
          isCheckingRef.current = false;
        }

        if (results === aborted) {
          setDialogState(null);
          return;
        }

        const failingRules = failingRuleIds(results);

        if (failingRules.length > 0) {
          const failingChecks = results
            .filter((result) => result.issueCount > 0)
            .map((result) => result.check);
          const reviewTarget =
            failingChecks.length === 1 ? failingChecks[0] : "summary";

          userTracking.capture({
            name: "simulation.validation.issuesFound",
            issueCount: results.reduce(
              (total, result) => total + result.issueCount,
              0,
            ),
            rules: failingRules,
          });
          setDialogState({
            type: "preSimulationChecks",
            status: "issuesFound",
            failingRules,
            onReview: () => reviewChecks(reviewTarget),
            onRunAnyway: runWithIssues,
            onCancel: dismiss("issuesFound"),
          });
          return;
        }

        await run();
      },
      [
        setSimulationState,
        setDialogState,
        userTracking,
        toggleNetworkReview,
        ensureFresh,
      ],
    ),
  );

  return runSimulation;
};
