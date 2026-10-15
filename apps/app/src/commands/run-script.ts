import { useSetAtom, useStore, type Getter } from "jotai";
import { useCallback, useContext } from "react";
import { Just } from "purify-ts/Maybe";
import {
  getScripting,
  type ScriptEvent,
  type ScriptProject,
  type ScriptRunOutcome,
  type ScriptTargets,
  type ScriptViewport,
} from "src/lib/scripting";
import { MapContext } from "src/map";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { USelection, type Sel } from "src/selection";
import { chooseUnitSystem } from "src/simulation/build-inp";
import { dialogAtom } from "src/state/dialog";
import {
  currentFileNameAtom,
  inpFileInfoAtom,
  isDemoNetworkAtom,
  projectFileInfoAtom,
} from "src/state/file-system";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";
import type { ProjectSettings } from "@epanet-js/project-settings";
import { projectSettingsAtom } from "src/state/project-settings";
import {
  scriptRunAtom,
  type ScriptConsoleLine,
  type ScriptRunState,
} from "src/state/scripts";
import { selectionAtom } from "src/state/selection";

const MAX_CONSOLE_LINES = 1000;

export const useRunScript = () => {
  const store = useStore();
  const setRun = useSetAtom(scriptRunAtom);
  const setDialog = useSetAtom(dialogAtom);
  const setSelection = useSetAtom(selectionAtom);
  const zoomTo = useZoomTo();
  const map = useContext(MapContext);

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
    },
    [store, setSelection, zoomTo],
  );

  return useCallback(
    ({ name, source }: { name: string; source: string }) => {
      const scripting = getScripting();
      if (!scripting) return;
      if (store.get(scriptRunAtom)?.status === "running") return;

      const updateRun = (update: (run: ScriptRunState) => ScriptRunState) =>
        setRun((run) => run && update(run));

      const onEvent = (event: ScriptEvent) => {
        if (event.type === "progress") {
          updateRun((run) => ({
            ...run,
            progress: event.fraction,
            progressMessage: event.message,
          }));
          return;
        }
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
        viewport: currentViewport(),
        project: scriptProjectOf(store.get),
        onEvent,
      });
      setRun({
        name,
        status: "running",
        lines: [],
        progress: null,
        progressMessage: null,
        outcome: null,
        startedAt: performance.now(),
        finishedAt: null,
        cancel: handle.cancel,
      });
      setDialog({ type: "scriptRun" });

      void handle.finished.then((outcome) => {
        updateRun((run) => ({
          ...run,
          status: "finished",
          outcome,
          finishedAt: performance.now(),
        }));
        applyOutcome(outcome);
      });
    },
    [store, setRun, setDialog, applyOutcome, currentViewport],
  );
};

const selectedTargets = (selection: Sel): ScriptTargets => ({
  assetIds: [...USelection.getAssetIds(selection)],
  customerPointIds: [...USelection.getCustomerPointIds(selection)],
});

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

const unitSystemOf = (units: ProjectSettings["units"]): string => {
  try {
    return chooseUnitSystem(units);
  } catch {
    return "";
  }
};
