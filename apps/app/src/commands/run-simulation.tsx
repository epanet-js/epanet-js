import { useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { useCallback, useRef } from "react";
import { buildSimulationInp } from "src/simulation/build-inp";
import { dialogAtom } from "src/state/dialog";
import {
  stagingModelDerivedAtom,
  simulationDerivedAtom,
  simulationSettingsDerivedAtom,
  simulationSourceIdDerivedAtom,
} from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";
import { opfsAvailableAtom } from "src/state/opfs";
import { isScriptSimulatingAtom } from "src/state/simulation";
import {
  ProgressCallback,
  runSimulation as runSimulationWorker,
} from "src/simulation";
import { useRecordSimulationRun } from "src/hooks/use-record-simulation-run";
import { getAppId } from "src/infra/app-instance";
import { worktreeAtom } from "src/state/scenarios";
import { nanoid } from "src/lib/id";
import { useUserTracking } from "src/infra/user-tracking";
import { useShowNetworkReview } from "src/commands/show-network-review";
import { selectedReviewCheckAtom } from "src/state/network-review";
import {
  CheckType,
  failingRuleIds,
  simulationBlockers,
} from "src/lib/network-review";
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
  const showNetworkReview = useShowNetworkReview();
  const { ensureFresh } = useReviewChecks();
  const isCheckingRef = useRef(false);
  const recordSimulationRun = useRecordSimulationRun();

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
        if (get(isScriptSimulatingAtom)) return;

        const hydraulicModel = get(stagingModelDerivedAtom);
        const simulationSettings = get(simulationSettingsDerivedAtom);
        const worktree = get(worktreeAtom);
        const projectSettings = get(projectSettingsAtom);

        const run = async () => {
          if (get(isScriptSimulatingAtom)) {
            if (get(dialogAtom)?.type === "preSimulationChecks") {
              setDialogState(null);
            }
            return;
          }
          const currentSimulation = get(simulationDerivedAtom);
          setSimulationState({ ...currentSimulation, status: "running" });
          const inp = buildSimulationInp(hydraulicModel, {
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

          const epsReader = await recordSimulationRun({
            status,
            report,
            metadata,
            location: { appId, scenarioKey, runId },
            modelVersion: hydraulicModel.version,
            simulationSettings,
            previousReader,
            previousSourceId,
          });

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
          showNetworkReview({ source: "auto" });
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

        const blockers = simulationBlockers(results, hydraulicModel);
        const failingRules = failingRuleIds(blockers);

        if (failingRules.length > 0) {
          const failingChecks = blockers
            .filter((result) => result.issueCount > 0)
            .map((result) => result.check);
          const reviewTarget =
            failingChecks.length === 1 ? failingChecks[0] : "summary";

          userTracking.capture({
            name: "simulation.validation.issuesFound",
            issueCount: blockers.reduce(
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
        showNetworkReview,
        ensureFresh,
        recordSimulationRun,
      ],
    ),
  );

  return runSimulation;
};
