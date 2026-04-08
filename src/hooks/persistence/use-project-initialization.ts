import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import type { HydraulicModel } from "src/hydraulic-model";
import type { ModelFactories } from "src/hydraulic-model/factories";
import type { ProjectSettings } from "src/lib/project-settings";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import { OPFSStorage } from "src/infra/storage";
import { getAppId } from "src/infra/app-instance";
import { MomentLog } from "src/lib/persistence/moment-log";
import { initializeWorktree } from "src/lib/worktree";
import { stagingModelAtom, baseModelAtom } from "src/state/hydraulic-model";
import { modelFactoriesAtom } from "src/state/model-factories";
import { modelCacheAtom } from "src/state/model-cache";
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
import { branchStateAtom } from "src/state/branch-state";

type InitializeProjectInput = {
  hydraulicModel: HydraulicModel;
  factories: ModelFactories;
  projectSettings: ProjectSettings;
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
    projectSettings,
    simulationSettings,
    autoElevations,
  }: InitializeProjectInput,
) => {
  const momentLog = new MomentLog();

  set(stagingModelAtom, hydraulicModel);
  set(baseModelAtom, hydraulicModel);
  set(modelFactoriesAtom, factories);
  set(projectSettingsAtom, projectSettings);
  set(momentLogAtom, momentLog);
  set(simulationSettingsAtom, simulationSettings);
  if (autoElevations !== undefined) {
    set(autoElevationsAtom, autoElevations);
  }

  set(
    worktreeAtom,
    initializeWorktree({
      momentLog,
      version: hydraulicModel.version,
      simulationSettings,
    }),
  );

  set(
    modelCacheAtom,
    new Map([
      ["main", { model: hydraulicModel, labelManager: factories.labelManager }],
    ]),
  );

  set(
    branchStateAtom,
    new Map([
      [
        "main",
        {
          version: hydraulicModel.version,
          hydraulicModel,
          labelManager: factories.labelManager,
          momentLog,
          simulation: null,
          simulationSourceId: "main",
          simulationSettings,
        },
      ],
    ]),
  );
};

const clearSimulationStorage = async () => {
  const storage = new OPFSStorage(getAppId());
  await storage.clear();
};

export const useProjectInitialization = () => {
  const initializeProject = useAtomCallback(
    useCallback(
      async (_get: Getter, set: Setter, input: InitializeProjectInput) => {
        await clearSimulationStorage();
        resetAppState(set);
        loadModel(set, input);
      },
      [],
    ),
  );

  return { initializeProject };
};
