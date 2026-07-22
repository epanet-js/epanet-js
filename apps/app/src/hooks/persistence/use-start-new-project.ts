import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import { useSetAtom } from "jotai";
import type { Getter, Setter } from "jotai";
import * as db from "src/lib/db";
import { captureWarning } from "src/infra/error-tracking";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import {
  type HydraulicModel,
  initializeHydraulicModel,
} from "src/hydraulic-model";
import {
  type ModelFactories,
  initializeModelFactories,
  LabelManager,
} from "@epanet-js/hydraulic-model";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";
import {
  type ProjectSettings,
  defaultProjectSettings,
} from "src/lib/project-settings";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { inpFileInfoAtom, projectFileInfoAtom } from "src/state/file-system";
import type { PipeMaterial } from "@epanet-js/pipe-library";
import type { Zones } from "src/lib/zones";
import { initializeZones } from "src/lib/zones";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import { OPFSStorage } from "src/infra/storage";
import { getAppId } from "src/infra/app-instance";
import { MomentLog } from "src/lib/persistence/moment-log";
import { writeQueue } from "src/lib/persistence/write-queue";
import { initializeWorktree } from "src/lib/worktree";
import { dialogAtom } from "src/state/dialog";
import { modelFactoriesAtom } from "src/state/model-factories";
import { projectSettingsAtom } from "src/state/project-settings";
import { momentLogAtom } from "src/state/model-changes";
import {
  simulationSettingsDerivedAtom,
  stagingModelDerivedAtom,
} from "src/state/derived-branch-state";
import { worktreeAtom } from "src/state/scenarios";
import { splitsAtom, defaultSplits } from "src/state/layout";
import { mapSyncMomentAtom } from "src/state/map";
import {
  nodeSymbologyAtom,
  linkSymbologyAtom,
  savedSymbologiesAtom,
  propertyColorConfigAtom,
  defaultPropertyColorConfigs,
  nodeSizeAtom,
} from "src/state/map-symbology";
import { nullSymbologySpec, defaultNodeSizeConfig } from "src/map/symbology";
import { modeAtom, Mode } from "src/state/mode";
import {
  ephemeralStateAtom,
  pipeDrawingDefaultsAtom,
  autoElevationsAtom,
} from "src/state/drawing";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";
import { branchStateAtom } from "src/state/branch-state";
import {
  sourceRebuildDurationsAtom,
  resultsFetchDurationsAtom,
} from "src/state/performance";
import {
  initialPlaybackState,
  simulationPlaybackAtom,
} from "src/state/simulation-playback";
import { zonesAtom } from "src/state/zones";
import { pipeMaterialsAtom } from "src/state/pipe-library";
import { hglProfileAtom, hglProfileOpenAtom } from "src/state/hgl-profile";
import { bottomActiveTabAtom } from "src/state/panel-layout";

export type ProjectLoadInput = {
  hydraulicModel: HydraulicModel;
  factories: ModelFactories;
  projectSettings: ProjectSettings;
  pipeLibrary?: PipeMaterial[];
  zones?: Zones;
  simulationSettings: SimulationSettings;
  autoElevations?: boolean;
};

export const resetAppState = (set: Setter) => {
  set(splitsAtom, defaultSplits);
  set(selectionAtom, USelection.none());
  set(mapSyncMomentAtom, { pointer: -1, version: 0 });
  set(nodeSymbologyAtom, nullSymbologySpec.node);
  set(linkSymbologyAtom, nullSymbologySpec.link);
  set(savedSymbologiesAtom, new Map());
  set(propertyColorConfigAtom, defaultPropertyColorConfigs);
  set(nodeSizeAtom, defaultNodeSizeConfig);
  set(modeAtom, { mode: Mode.NONE });
  set(hglProfileAtom, null);
  set(hglProfileOpenAtom, false);
  set(bottomActiveTabAtom, null);
  set(ephemeralStateAtom, { type: "none" });
  set(pipeDrawingDefaultsAtom, {});
  set(autoElevationsAtom, true);
  set(sourceRebuildDurationsAtom, []);
  set(resultsFetchDurationsAtom, []);
  set(simulationPlaybackAtom, initialPlaybackState);
  set(zonesAtom, initializeZones());
  set(pipeMaterialsAtom, []);
};

export const loadModel = (
  set: Setter,
  input: ProjectLoadInput,
): ProjectSettings => {
  const {
    hydraulicModel,
    factories,
    projectSettings,
    zones,
    simulationSettings,
    autoElevations,
  } = input;
  const momentLog = new MomentLog(hydraulicModel.version);

  writeQueue.reset();

  set(modelFactoriesAtom, factories);
  const mergedProjectSettings: ProjectSettings = {
    ...projectSettings,
    units: {
      ...projectSettings.units,
      chemicalConcentration: simulationSettings.qualityMassUnit,
    },
  };
  set(projectSettingsAtom, mergedProjectSettings);
  set(zonesAtom, zones ?? initializeZones());
  set(momentLogAtom, momentLog);
  set(pipeMaterialsAtom, input.pipeLibrary ?? []);
  if (autoElevations !== undefined) {
    set(autoElevationsAtom, autoElevations);
  }

  set(worktreeAtom, initializeWorktree());

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
          simulationResults: null,
        },
      ],
    ]),
  );

  return mergedProjectSettings;
};

export const clearSimulationStorage = async () => {
  const storage = new OPFSStorage(getAppId());
  await storage.clear();
};

export const useStartNewProject = () => {
  const isTrackModelSharingOn = useFeatureFlag("FLAG_TRACK_MODEL_SHARING");

  const startNewProject = useAtomCallback(
    useCallback(
      async (_get: Getter, set: Setter, input: ProjectLoadInput) => {
        await clearSimulationStorage();
        const mergedProjectSettings: ProjectSettings = {
          ...input.projectSettings,
          units: {
            ...input.projectSettings.units,
            chemicalConcentration: input.simulationSettings.qualityMassUnit,
          },
        };
        await db.importProject({
          newDb: true,
          projectSettings: mergedProjectSettings,
          hydraulicModel: input.hydraulicModel,
          simulationSettings: input.simulationSettings,
        });

        let modelInput = input;
        if (isTrackModelSharingOn) {
          try {
            const uniqueId = await db.ensureUniqueId();
            modelInput = {
              ...input,
              projectSettings: { ...input.projectSettings, uniqueId },
            };
          } catch (e: unknown) {
            captureWarning(
              "Failed to stamp unique id on new project",
              e instanceof Error ? e : new Error(String(e)),
            );
          }
        }

        resetAppState(set);
        loadModel(set, modelInput);
      },
      [isTrackModelSharingOn],
    ),
  );

  return { startNewProject };
};

export const useStartBlankProject = () => {
  const { startNewProject } = useStartNewProject();
  const setInpFileInfo = useSetAtom(inpFileInfoAtom);
  const setProjectFileInfo = useSetAtom(projectFileInfoAtom);
  return useCallback(
    async ({
      projectSettings = defaultProjectSettings,
      autoElevations,
    }: {
      projectSettings?: ProjectSettings;
      autoElevations?: boolean;
    } = {}) => {
      const idGenerator = new ConsecutiveIdsGenerator();
      const hydraulicModel = initializeHydraulicModel({ idGenerator });
      const factories = initializeModelFactories({
        idGenerator,
        labelManager: new LabelManager(),
      });
      await startNewProject({
        hydraulicModel,
        factories,
        projectSettings,
        simulationSettings: defaultSimulationSettings,
        autoElevations,
      });
      setInpFileInfo(null);
      setProjectFileInfo(null);
    },
    [startNewProject, setInpFileInfo, setProjectFileInfo],
  );
};

export const useSeedDefaultProjectDb = () => {
  const isTrackModelSharingOn = useFeatureFlag("FLAG_TRACK_MODEL_SHARING");

  return useAtomCallback(
    useCallback(
      (get: Getter, set: Setter): Promise<void> => {
        const projectSettings = get(projectSettingsAtom);
        const hydraulicModel = get(stagingModelDerivedAtom);
        const simulationSettings = get(simulationSettingsDerivedAtom);

        resetAppState(set);
        loadModel(set, {
          hydraulicModel,
          factories: get(modelFactoriesAtom),
          projectSettings,
          simulationSettings,
        });

        return db
          .importProject({
            newDb: true,
            projectSettings,
            hydraulicModel,
            simulationSettings,
          })
          .then(async () => {
            if (isTrackModelSharingOn) {
              try {
                const uniqueId = await db.ensureUniqueId();
                set(projectSettingsAtom, {
                  ...get(projectSettingsAtom),
                  uniqueId,
                });
              } catch (e: unknown) {
                captureWarning(
                  "Failed to stamp unique id on default project db",
                  e instanceof Error ? e : new Error(String(e)),
                );
              }
            }
          })
          .catch((e: unknown) => {
            const error = e instanceof Error ? e : new Error(String(e));
            captureWarning("Failed to seed default project db", error);
            set(dialogAtom, {
              type: "appLoadFailed",
              errorMessage: error.message,
            });
          });
      },
      [isTrackModelSharingOn],
    ),
  );
};
