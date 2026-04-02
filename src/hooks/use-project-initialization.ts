import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import type { HydraulicModel } from "src/hydraulic-model";
import type { ModelFactories } from "src/hydraulic-model/factories";
import type { IdGenerator } from "src/lib/id-generator";
import type { ProjectSettings } from "src/lib/project-settings";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import type { Moment } from "src/lib/persistence/moment";
import type { Snapshot, Worktree } from "src/lib/worktree/types";
import { MomentLog } from "src/lib/persistence/moment-log";
import { trackMoment } from "src/lib/persistence/shared";
import { toDemandAssignments } from "src/hydraulic-model/model-operation";
import { stagingModelAtom, baseModelAtom } from "src/state/hydraulic-model";
import { modelFactoriesAtom } from "src/state/model-factories";
import { projectSettingsAtom } from "src/state/project-settings";
import { momentLogAtom } from "src/state/model-changes";
import { simulationSettingsAtom } from "src/state/simulation-settings";
import { worktreeAtom } from "src/state/scenarios";
import {
  simulationAtom,
  initialSimulationState,
  simulationResultsAtom,
} from "src/state/simulation";
import { splitsAtom, defaultSplits } from "src/state/layout";
import { dataAtom, nullData } from "src/state/data";
import { mapSyncMomentAtom } from "src/state/map";
import {
  nodeSymbologyAtom,
  linkSymbologyAtom,
  savedSymbologiesAtom,
  propertyColorConfigAtom,
  defaultPropertyColorConfigs,
} from "src/state/map-symbology";
import { nullSymbologySpec } from "src/map/symbology";
import { modeAtom, Mode } from "src/state/mode";
import {
  ephemeralStateAtom,
  pipeDrawingDefaultsAtom,
  autoElevationsAtom,
} from "src/state/drawing";
import { selectionAtom } from "src/state/selection";

type InitializeProjectInput = {
  hydraulicModel: HydraulicModel;
  factories: ModelFactories;
  idGenerator: IdGenerator;
  projectSettings: ProjectSettings;
  name: string;
  simulationSettings: SimulationSettings;
  autoElevations?: boolean;
};

const resetAppState = (set: Setter) => {
  set(splitsAtom, defaultSplits);
  set(dataAtom, nullData);
  set(mapSyncMomentAtom, { pointer: -1, version: 0 });
  set(simulationAtom, initialSimulationState);
  set(simulationResultsAtom, null);
  set(nodeSymbologyAtom, nullSymbologySpec.node);
  set(linkSymbologyAtom, nullSymbologySpec.link);
  set(savedSymbologiesAtom, new Map());
  set(propertyColorConfigAtom, defaultPropertyColorConfigs);
  set(modeAtom, { mode: Mode.NONE });
  set(ephemeralStateAtom, { type: "none" });
  set(selectionAtom, { type: "none" });
  set(pipeDrawingDefaultsAtom, {});
  set(autoElevationsAtom, true);
};

const loadModel = (
  set: Setter,
  {
    hydraulicModel,
    factories,
    idGenerator,
    projectSettings,
    name,
    simulationSettings,
    autoElevations,
  }: InitializeProjectInput,
) => {
  const assets = [...hydraulicModel.assets.values()];

  const snapshotMoment: Moment = {
    note: `Import ${name}`,
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

  trackMoment({ note: snapshotMoment.note!, putAssets: assets });

  assets.forEach((asset) => {
    factories.labelManager.register(asset.label, asset.type, asset.id);
    if (asset.isLink) {
      hydraulicModel.assetIndex.addLink(asset.id);
    } else if (asset.isNode) {
      hydraulicModel.assetIndex.addNode(asset.id);
    }
  });

  hydraulicModel.customerPoints.forEach((cp) => {
    factories.labelManager.register(cp.label, "customerPoint", cp.id);
  });

  const momentLog = new MomentLog();
  momentLog.setSnapshot(snapshotMoment, hydraulicModel.version);

  set(stagingModelAtom, hydraulicModel);
  set(baseModelAtom, hydraulicModel);
  set(modelFactoriesAtom, factories);
  set(projectSettingsAtom, projectSettings);
  set(momentLogAtom, momentLog);
  set(simulationSettingsAtom, simulationSettings);
  if (autoElevations !== undefined) {
    set(autoElevationsAtom, autoElevations);
  }

  const labelCounters: Worktree["labelCounters"] = new Map();
  factories.labelManager.adoptCounters(labelCounters);

  const mainSnapshot: Snapshot = {
    id: "main",
    name: "Main",
    parentId: null,
    deltas: [snapshotMoment],
    version: hydraulicModel.version,
    momentLog,
    simulation: initialSimulationState,
    simulationSourceId: "main",
    simulationSettings,
    status: "open",
  };

  set(worktreeAtom, {
    activeSnapshotId: "main",
    lastActiveSnapshotId: "main",
    snapshots: new Map([["main", mainSnapshot]]),
    mainId: "main",
    scenarios: [],
    highestScenarioNumber: 0,
    labelCounters,
    idGenerator,
  });
};

export const useProjectInitialization = () => {
  const initializeProject = useAtomCallback(
    useCallback((_get: Getter, set: Setter, input: InitializeProjectInput) => {
      resetAppState(set);
      loadModel(set, input);
    }, []),
  );

  return { initializeProject };
};
