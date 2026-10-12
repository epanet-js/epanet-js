import { useSetAtom, useStore } from "jotai";
import { useCallback, useContext } from "react";
import { Just } from "purify-ts/Maybe";
import {
  getScripting,
  type ScriptBBox,
  type ScriptEvent,
  type ScriptRunOutcome,
} from "src/lib/scripting";
import { MapContext } from "src/map";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { USelection } from "src/selection";
import { dialogAtom } from "src/state/dialog";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";
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

  const currentViewport = useCallback((): ScriptBBox | null => {
    const bounds = map?.map.getBounds();
    if (!bounds) return null;
    const [[west, south], [east, north]] = bounds.toArray();
    return [west, south, east, north];
  }, [map]);

  const applyOutcome = useCallback(
    (outcome: ScriptRunOutcome) => {
      if (outcome.status !== "success") return;
      const { assets } = store.get(stagingModelDerivedAtom);
      const existing = (ids: number[]) => ids.filter((id) => assets.has(id));
      if (outcome.selection) {
        setSelection(USelection.fromAssetIds(existing(outcome.selection)));
      }
      if (outcome.zoomTo?.type === "assets") {
        zoomTo(USelection.fromAssetIds(existing(outcome.zoomTo.ids)));
      }
      if (outcome.zoomTo?.type === "bbox") {
        zoomTo(Just(outcome.zoomTo.bbox));
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
          updateRun((run) => ({ ...run, progress: event.fraction }));
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
        selectedAssetIds: USelection.getAssetIds(store.get(selectionAtom)),
        viewport: currentViewport(),
        onEvent,
      });
      setRun({
        name,
        status: "running",
        lines: [],
        progress: null,
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
