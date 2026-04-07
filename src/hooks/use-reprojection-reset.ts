import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import type { HydraulicModel, ModelMoment } from "src/hydraulic-model";
import { stagingModelAtom, baseModelAtom } from "src/state/hydraulic-model";
import { momentLogAtom } from "src/state/model-changes";
import { mapSyncMomentAtom } from "src/state/map";
import {
  simulationAtom,
  initialSimulationState,
  simulationResultsAtom,
} from "src/state/simulation";
import { simulationSettingsAtom } from "src/state/simulation-settings";
import { selectionAtom } from "src/state/selection";
import { projectSettingsAtom } from "src/state/project-settings";
import { modelFactoriesAtom } from "src/state/model-factories";
import { modelCacheAtom } from "src/state/model-cache";
import { modeAtom, Mode } from "src/state/mode";
import { ephemeralStateAtom, autoElevationsAtom } from "src/state/drawing";
import { worktreeAtom } from "src/state/scenarios";
import { MomentLog } from "src/lib/persistence/moment-log";
import { toDemandAssignments } from "src/hydraulic-model/model-operation";
import { transformCoordinates } from "src/hydraulic-model/mutations/transform-coordinates";
import { createProjectionMapper } from "src/lib/projections";
import type { Projection } from "src/lib/projections/projection";
import type { Snapshot, Worktree } from "src/lib/worktree/types";
import type { LabelManager } from "src/hydraulic-model/label-manager";
import type { SimulationSettings } from "src/simulation/simulation-settings";

function resetWorktree(
  get: Getter,
  set: Setter,
  moment: ModelMoment,
  version: string,
  momentLog: MomentLog,
  simulationSettings: SimulationSettings,
  labelManager: LabelManager,
): void {
  const mainSnapshot: Snapshot = {
    id: "main",
    name: "Main",
    parentId: null,
    deltas: [moment],
    version,
    momentLog,
    simulation: initialSimulationState,
    simulationSourceId: "main",
    simulationSettings,
    status: "open",
  };

  const worktree: Worktree = {
    activeSnapshotId: "main",
    lastActiveSnapshotId: "main",
    snapshots: new Map([["main", mainSnapshot]]),
    mainId: "main",
    scenarios: [],
    highestScenarioNumber: 0,
  };

  set(worktreeAtom, worktree);

  const cache = new Map<
    string,
    { model: HydraulicModel; labelManager: LabelManager }
  >();
  const importedModel = get(stagingModelAtom);
  cache.set("main", { model: importedModel, labelManager });
  set(modelCacheAtom, cache);
}

export const useReprojectionReset = () => {
  const reprojectionReset = useAtomCallback(
    useCallback(
      async (
        get: Getter,
        set: Setter,
        newProjection: Projection,
        currentProjection: Projection,
      ) => {
        const hydraulicModel = get(stagingModelAtom);
        const simulationSettings = get(simulationSettingsAtom);

        const currentMapper = createProjectionMapper(currentProjection);
        const newMapper = createProjectionMapper(newProjection);
        transformCoordinates(hydraulicModel, (p) => {
          const source = currentMapper.toSource(p);
          return newMapper.toWgs84(source);
        });

        const assets = [...hydraulicModel.assets.values()];
        const snapshotMoment: ModelMoment = {
          note: "Reprojection",
          putAssets: assets,
          deleteAssets: [],
          patchAssetsAttributes: [],
          putDemands: {
            assignments: toDemandAssignments(hydraulicModel.demands),
          },
          putControls: hydraulicModel.controls,
          putCustomerPoints: [...hydraulicModel.customerPoints.values()],
          putCurves: hydraulicModel.curves,
          putPatterns: hydraulicModel.patterns,
        };

        const momentLog = new MomentLog();
        momentLog.setSnapshot(snapshotMoment, hydraulicModel.version);

        const updatedProjectSettings = {
          ...get(projectSettingsAtom),
          projection: newProjection,
        };

        const [{ OPFSStorage }, { getAppId }] = await Promise.all([
          import("src/infra/storage"),
          import("src/infra/app-instance"),
        ]);
        const storage = new OPFSStorage(getAppId());
        await storage.clear();

        set(stagingModelAtom, { ...hydraulicModel });
        set(baseModelAtom, { ...hydraulicModel });
        set(projectSettingsAtom, updatedProjectSettings);
        set(momentLogAtom, momentLog);
        set(mapSyncMomentAtom, { pointer: -1, version: 0 });
        set(simulationAtom, initialSimulationState);
        set(simulationResultsAtom, null);
        set(modeAtom, { mode: Mode.NONE });
        set(ephemeralStateAtom, { type: "none" });
        set(selectionAtom, { type: "none" });
        set(autoElevationsAtom, newProjection.type !== "xy-grid");

        resetWorktree(
          get,
          set,
          snapshotMoment,
          hydraulicModel.version,
          momentLog,
          simulationSettings,
          get(modelFactoriesAtom).labelManager,
        );
      },
      [],
    ),
  );

  return { reprojectionReset };
};
