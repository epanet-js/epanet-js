import { useSetAtom, useStore, type Getter } from "jotai";
import { useCallback, useContext } from "react";
import { Just } from "purify-ts/Maybe";
import {
  getScripting,
  type ScriptEvent,
  type ScriptLastResults,
  type ScriptProject,
  type ScriptRunOutcome,
  type ScriptSimulationSettings,
  type ScriptTargets,
  type ScriptViewport,
} from "src/lib/scripting";
import { MapContext } from "src/map";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { usePermissions } from "src/hooks/use-permissions";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useFeatureLock } from "src/components/form/paywall";
import { useUserTracking } from "src/infra/user-tracking";
import { useSelectionSetsTransaction } from "src/hooks/persistence/use-selection-sets-transaction";
import { useBookmarksTransaction } from "src/hooks/persistence/use-bookmarks-transaction";
import {
  countSelected,
  newBookmark,
  newSelectionSet,
} from "src/lib/collections";
import { USelection, type Sel } from "src/selection";
import { chooseUnitSystem, defaultAccuracy } from "src/simulation/build-inp";
import {
  defaultHydraulicsValues,
  type SimulationSettings,
} from "src/simulation/simulation-settings";
import { dialogAtom } from "src/state/dialog";
import {
  currentFileNameAtom,
  inpFileInfoAtom,
  isDemoNetworkAtom,
  projectFileInfoAtom,
} from "src/state/file-system";
import {
  simulationDerivedAtom,
  simulationSettingsDerivedAtom,
  stagingModelDerivedAtom,
} from "src/state/derived-branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";
import type { ProjectSettings } from "@epanet-js/project-settings";
import { projectSettingsAtom } from "src/state/project-settings";
import {
  scriptRunAtom,
  type ScriptConsoleLine,
  type ScriptRunState,
} from "src/state/scripts";
import { selectionAtom } from "src/state/selection";
import { simulationStepAtom } from "src/state/simulation";
import { bookmarksAtom, selectionSetsAtom } from "src/state/collections";
import { zonesAtom } from "src/state/zones";
import { useShowScriptOutput } from "./show-script-output";

const MAX_CONSOLE_LINES = 1000;
const EPANET_DEFAULT_TRIALS = 200;
const DEFAULT_UNBALANCED_EXTRA_TRIALS = 10;

export const useRunScript = () => {
  const store = useStore();
  const setRun = useSetAtom(scriptRunAtom);
  const setDialog = useSetAtom(dialogAtom);
  const setSelection = useSetAtom(selectionAtom);
  const zoomTo = useZoomTo();
  const map = useContext(MapContext);
  const { canManageCollections, canRunScripts } = usePermissions();
  const { openPaywall } = useFeatureLock("runScripts");
  const userTracking = useUserTracking();
  const isScriptResultsOn = useFeatureFlag("FLAG_SCRIPT_RESULTS");
  const { create: createSelectionSet } = useSelectionSetsTransaction();
  const { transact: saveBookmarks } = useBookmarksTransaction();
  const isScriptOutputPanelOn = useFeatureFlag("FLAG_SCRIPT_OUTPUT_PANEL");
  const showScriptOutput = useShowScriptOutput();

  const currentViewport = useCallback((): ScriptViewport | null => {
    const bounds = map?.map.getBounds();
    if (!map || !bounds) return null;
    const [[west, south], [east, north]] = bounds.toArray();
    const { lng, lat } = map.map.getCenter();
    return {
      bounds: [west, south, east, north],
      center: [lng, lat],
      zoom: map.map.getZoom(),
    };
  }, [map]);

  const applyOutcome = useCallback(
    (outcome: ScriptRunOutcome) => {
      if (outcome.status !== "success") return;
      const { assets, customerPoints } = store.get(stagingModelDerivedAtom);
      const existing = ({ assetIds, customerPointIds }: ScriptTargets) =>
        USelection.fromIds(
          assetIds.filter((id) => assets.has(id)),
          customerPointIds.filter((id) => customerPoints.has(id)),
        );
      if (outcome.selection) {
        setSelection(existing(outcome.selection));
      }
      const maxZoom = outcome.zoomTo?.maxZoom ?? undefined;
      if (outcome.zoomTo?.type === "targets") {
        zoomTo(existing(outcome.zoomTo.targets), maxZoom);
      }
      if (outcome.zoomTo?.type === "bbox") {
        zoomTo(Just(outcome.zoomTo.bbox), maxZoom);
      }
      if (canManageCollections) {
        for (const { label, targets, commit } of outcome.selectionSets) {
          if (isScriptOutputPanelOn && !commit) continue;
          const members = existing(targets);
          if (countSelected(members) === 0) continue;
          createSelectionSet(newSelectionSet(label, members));
        }
        if (!isScriptOutputPanelOn && outcome.bookmarks.length > 0) {
          saveBookmarks([
            ...store.get(bookmarksAtom),
            ...outcome.bookmarks.map(({ label, bbox }) =>
              newBookmark(label, bbox),
            ),
          ]);
        }
      }
    },
    [
      store,
      setSelection,
      zoomTo,
      canManageCollections,
      isScriptOutputPanelOn,
      createSelectionSet,
      saveBookmarks,
    ],
  );

  return useCallback(
    (
      {
        name,
        source,
        paywalled,
        exampleId,
      }: {
        name: string;
        source: string;
        paywalled: boolean;
        exampleId: string | null;
      },
      trigger: "editor" | "list" | "shortcut",
    ) => {
      const scripting = getScripting();
      if (!scripting) return;
      if (store.get(scriptRunAtom)?.status === "running") return;
      userTracking.capture({
        name: "script.runStarted",
        scriptName: name,
        source: trigger,
        canRunScripts,
        isExample: exampleId !== null,
        exampleId: exampleId ?? "",
        isDemoNetwork: store.get(isDemoNetworkAtom),
      });
      if (paywalled && !canRunScripts) return openPaywall();

      const updateRun = (update: (run: ScriptRunState) => ScriptRunState) =>
        setRun((run) => run && update(run));

      let consoleLinesCount = 0;
      const onEvent = (event: ScriptEvent) => {
        if (event.type === "progress") {
          updateRun((run) => ({
            ...run,
            progress: event.fraction,
            progressMessage: event.message,
          }));
          return;
        }
        consoleLinesCount++;
        const line: ScriptConsoleLine =
          event.type === "console"
            ? { type: "text", level: event.level, text: event.text }
            : { type: "table", columns: event.columns, rows: event.rows };
        updateRun((run) => ({
          ...run,
          lines:
            run.lines.length >= MAX_CONSOLE_LINES
              ? [...run.lines.slice(1), line]
              : [...run.lines, line],
        }));
      };

      const handle = scripting.startScriptRun({
        source,
        model: store.get(stagingModelDerivedAtom),
        factories: store.get(modelFactoriesAtom),
        units: store.get(projectSettingsAtom).units,
        selected: selectedTargets(store.get(selectionAtom)),
        selectionSets: store
          .get(selectionSetsAtom)
          .map(({ label, selection }) => ({
            label,
            targets: selectedTargets(selection),
          })),
        bookmarks: store
          .get(bookmarksAtom)
          .map(({ label, bbox: [west, south, east, north] }) => ({
            label,
            bbox: [west, south, east, north],
          })),
        viewport: currentViewport(),
        project: scriptProjectOf(store.get),
        simulation: scriptSimulationOf(
          store.get(simulationSettingsDerivedAtom),
        ),
        inp: {
          simulationSettings: store.get(simulationSettingsDerivedAtom),
          projection: store.get(projectSettingsAtom).projection,
        },
        zones: store.get(zonesAtom),
        lastResults: isScriptResultsOn
          ? { isOn: true, value: lastResultsOf(store.get) }
          : { isOn: false },
        onEvent,
      });
      const startedAt = performance.now();
      setRun({
        name,
        status: "running",
        lines: [],
        progress: null,
        progressMessage: null,
        outcome: null,
        startedAt,
        finishedAt: null,
        cancel: handle.cancel,
      });
      setDialog({ type: "scriptRun" });
      if (isScriptOutputPanelOn) showScriptOutput();

      void handle.finished.then((outcome) => {
        const finishedAt = performance.now();
        updateRun((run) => ({
          ...run,
          status: "finished",
          outcome,
          finishedAt,
        }));
        applyOutcome(outcome);
        if (isScriptOutputPanelOn) {
          if (store.get(dialogAtom)?.type === "scriptRun") setDialog(null);
          showScriptOutput();
        }
        const success = outcome.status === "success" ? outcome : null;
        userTracking.capture({
          name: "script.runFinished",
          scriptName: name,
          status: outcome.status,
          durationMs: Math.round(finishedAt - startedAt),
          isExample: exampleId !== null,
          errorName: outcome.status === "error" ? outcome.error.name : "",
          consoleLinesCount,
          attachmentsCount: success?.attachments.length ?? 0,
          selectionSetsCount: success?.selectionSets.length ?? 0,
          bookmarksCount: success?.bookmarks.length ?? 0,
          appliedSelection: success?.selection != null,
          zoomed: success?.zoomTo != null,
        });
      });
    },
    [
      store,
      setRun,
      setDialog,
      applyOutcome,
      currentViewport,
      userTracking,
      canRunScripts,
      openPaywall,
      isScriptResultsOn,
      isScriptOutputPanelOn,
      showScriptOutput,
    ],
  );
};

const selectedTargets = (selection: Sel): ScriptTargets => ({
  assetIds: [...USelection.getAssetIds(selection)],
  customerPointIds: [...USelection.getCustomerPointIds(selection)],
});

const lastResultsOf = (get: Getter): ScriptLastResults | null => {
  const simulation = get(simulationDerivedAtom);
  if (simulation.status === "idle" || simulation.status === "running") {
    return null;
  }
  return {
    status: simulation.status,
    report: simulation.report,
    isStale:
      simulation.modelVersion !== get(stagingModelDerivedAtom).version ||
      simulation.settingsVersion !== get(simulationSettingsDerivedAtom).version,
    currentStep: get(simulationStepAtom) ?? 0,
    location: simulation.runLocation ?? null,
  };
};

const scriptProjectOf = (get: Getter): ScriptProject => {
  const settings = get(projectSettingsAtom);
  const fileName = get(currentFileNameAtom);
  return {
    name: fileName?.replace(/\.[^.]+$/, "") || settings.name || "Untitled",
    fileName,
    source: get(projectFileInfoAtom)
      ? "project"
      : get(inpFileInfoAtom)
        ? "inp"
        : "new",
    isDemo: get(isDemoNetworkAtom),
    unitSystem: unitSystemOf(settings.units),
    headlossFormula: settings.headlossFormula,
  };
};

const scriptSimulationOf = (
  settings: SimulationSettings,
): ScriptSimulationSettings => ({
  version: settings.version,
  duration: settings.timing.duration,
  hydraulicTimestep: settings.timing.hydraulicTimestep,
  reportTimestep: settings.timing.reportTimestep,
  patternTimestep: settings.timing.patternTimestep,
  qualityTimestep: settings.timing.qualityTimestep ?? null,
  ruleTimestep: settings.timing.ruleTimestep ?? null,
  globalDemandMultiplier: settings.globalDemandMultiplier,
  demandModel: settings.demandModel,
  minimumPressure: settings.minimumPressure,
  requiredPressure: settings.requiredPressure,
  pressureExponent: settings.pressureExponent,
  emitterExponent: settings.emitterExponent,
  backflowAllowed: settings.backflowAllowed,
  trials: settings.trials ?? EPANET_DEFAULT_TRIALS,
  accuracy: settings.accuracy ?? defaultAccuracy,
  unbalancedMode: settings.unbalancedMode ?? "CONTINUE",
  unbalancedExtraTrials:
    settings.unbalancedMode === undefined
      ? DEFAULT_UNBALANCED_EXTRA_TRIALS
      : (settings.unbalancedExtraTrials ?? 0),
  headError: settings.headError ?? defaultHydraulicsValues.headError,
  flowChange: settings.flowChange ?? defaultHydraulicsValues.flowChange,
  checkFreq: settings.checkFreq ?? defaultHydraulicsValues.checkFreq,
  maxCheck: settings.maxCheck ?? defaultHydraulicsValues.maxCheck,
  dampLimit: settings.dampLimit ?? defaultHydraulicsValues.dampLimit,
  viscosity: settings.viscosity ?? defaultHydraulicsValues.viscosity,
  specificGravity:
    settings.specificGravity ?? defaultHydraulicsValues.specificGravity,
  quality: settings.qualitySimulationType,
  qualityChemicalName: settings.qualityChemicalName,
  qualityMassUnit: settings.qualityMassUnit,
  qualityTraceNodeId: settings.qualityTraceNodeId,
  tolerance: settings.tolerance,
  diffusivity: settings.diffusivity,
  reactionBulkOrder: settings.reactionBulkOrder,
  reactionWallOrder: settings.reactionWallOrder,
  reactionTankOrder: settings.reactionTankOrder,
  reactionGlobalBulk: settings.reactionGlobalBulk,
  reactionGlobalWall: settings.reactionGlobalWall,
  reactionLimitingPotential: settings.reactionLimitingPotential,
  reactionRoughnessCorrelation: settings.reactionRoughnessCorrelation,
  reportEnergy: settings.reportEnergy,
  energyGlobalEfficiency: settings.energyGlobalEfficiency,
  energyGlobalPrice: settings.energyGlobalPrice,
  energyGlobalPatternId: settings.energyGlobalPatternId,
  energyDemandCharge: settings.energyDemandCharge,
  statusReport: settings.statusReport,
});

const unitSystemOf = (units: ProjectSettings["units"]): string => {
  try {
    return chooseUnitSystem(units);
  } catch {
    return "";
  }
};
