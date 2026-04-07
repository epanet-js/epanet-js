import type { IPersistenceWithSnapshots } from "src/lib/persistence/ipersistence";
import { worktreeAtom } from "src/state/scenarios";
import type { Snapshot, Worktree } from "src/lib/worktree/types";
import { dataAtom, nullData } from "src/state/data";
import {
  ephemeralStateAtom,
  pipeDrawingDefaultsAtom,
  autoElevationsAtom,
} from "src/state/drawing";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { splitsAtom, defaultSplits } from "src/state/layout";
import { modeAtom } from "src/state/mode";
import { momentLogAtom } from "src/state/model-changes";
import { selectionAtom } from "src/state/selection";
import {
  type SimulationState,
  simulationAtom,
  initialSimulationState,
} from "src/state/simulation";
import { Store } from "src/state";
import { baseModelAtom } from "src/state/hydraulic-model";
import { simulationResultsAtom } from "src/state/simulation";
import { trackMoment } from "./shared";
import {
  HydraulicModel,
  initializeHydraulicModel,
  applyMomentToModel,
} from "src/hydraulic-model";
import { ModelMoment } from "src/hydraulic-model";
import { nanoid } from "nanoid";
import type { ProjectSettings } from "src/lib/project-settings";
import { projectSettingsAtom } from "src/state/project-settings";
import { MomentLog } from "./moment-log";
import { Mode } from "src/state/mode";
import { getSimulationForState } from "src/lib/worktree";

import {
  linkSymbologyAtom,
  nodeSymbologyAtom,
  savedSymbologiesAtom,
  propertyColorConfigAtom,
  defaultPropertyColorConfigs,
} from "src/state/map-symbology";
import { nullSymbologySpec } from "src/map/symbology";
import { mapSyncMomentAtom } from "src/state/map";
import { USelection } from "src/selection";
import { toDemandAssignments } from "src/hydraulic-model/model-operation";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import { simulationSettingsAtom } from "src/state/simulation-settings";
import {
  ModelFactories,
  initializeModelFactories,
} from "src/hydraulic-model/factories";
import { modelFactoriesAtom } from "src/state/model-factories";
import { LabelManager } from "src/hydraulic-model/label-manager";
import type { Projection } from "src/lib/projections/projection";
import { createProjectionMapper } from "src/lib/projections";
import { transformCoordinates } from "src/hydraulic-model/mutations/transform-coordinates";
import { modelCacheAtom } from "src/state/model-cache";
import {
  applyMoment,
  computeSyncMoment,
  syncSnapshotMomentLog,
  updateModelCache,
} from "./transaction-helpers";

export class Persistence implements IPersistenceWithSnapshots {
  private store: Store;

  constructor(store: Store) {
    this.store = store;
  }
  useTransactImportDeprecated() {
    return (
      hydraulicModel: HydraulicModel,
      factories: ModelFactories,
      projectSettings: ProjectSettings,
      name: string,
      simulationSettings: SimulationSettings,
      options?: { autoElevations?: boolean },
    ) => {
      const momentLog = new MomentLog();

      const assets = [...hydraulicModel.assets.values()];

      const snapshotMoment: ModelMoment = {
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

      trackMoment({ note: snapshotMoment.note, putAssets: assets });

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

      momentLog.setSnapshot(snapshotMoment, hydraulicModel.version);
      this.store.set(splitsAtom, defaultSplits);
      this.store.set(stagingModelAtom, hydraulicModel);
      this.store.set(baseModelAtom, hydraulicModel);
      this.store.set(modelFactoriesAtom, factories);
      this.store.set(dataAtom, {
        ...nullData,
        folderMap: new Map(),
      });
      this.store.set(projectSettingsAtom, projectSettings);
      this.store.set(momentLogAtom, momentLog);
      this.store.set(mapSyncMomentAtom, { pointer: -1, version: 0 });
      this.store.set(simulationAtom, initialSimulationState);
      this.store.set(simulationResultsAtom, null);
      this.store.set(nodeSymbologyAtom, nullSymbologySpec.node);
      this.store.set(linkSymbologyAtom, nullSymbologySpec.link);
      this.store.set(savedSymbologiesAtom, new Map());
      this.store.set(propertyColorConfigAtom, defaultPropertyColorConfigs);
      this.store.set(modeAtom, { mode: Mode.NONE });
      this.store.set(ephemeralStateAtom, { type: "none" });
      this.store.set(selectionAtom, { type: "none" });
      this.store.set(pipeDrawingDefaultsAtom, {});
      this.store.set(autoElevationsAtom, options?.autoElevations ?? true);
      this.store.set(simulationSettingsAtom, simulationSettings);

      this.resetWorktree(
        snapshotMoment,
        hydraulicModel.version,
        momentLog,
        simulationSettings,
        factories.labelManager,
      );
    };
  }

  useTransactReprojection() {
    return async (newProjection: Projection, currentProjection: Projection) => {
      const hydraulicModel = this.store.get(stagingModelAtom);
      const simulationSettings = this.store.get(simulationSettingsAtom);

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
        ...this.store.get(projectSettingsAtom),
        projection: newProjection,
      };

      const [{ OPFSStorage }, { getAppId }] = await Promise.all([
        import("src/infra/storage"),
        import("src/infra/app-instance"),
      ]);
      const storage = new OPFSStorage(getAppId());
      await storage.clear();

      this.store.set(stagingModelAtom, { ...hydraulicModel });
      this.store.set(baseModelAtom, { ...hydraulicModel });
      this.store.set(projectSettingsAtom, updatedProjectSettings);
      this.store.set(momentLogAtom, momentLog);
      this.store.set(mapSyncMomentAtom, { pointer: -1, version: 0 });
      this.store.set(simulationAtom, initialSimulationState);
      this.store.set(simulationResultsAtom, null);
      this.store.set(modeAtom, { mode: Mode.NONE });
      this.store.set(ephemeralStateAtom, { type: "none" });
      this.store.set(selectionAtom, { type: "none" });
      this.store.set(autoElevationsAtom, newProjection.type !== "xy-grid");

      this.resetWorktree(
        snapshotMoment,
        hydraulicModel.version,
        momentLog,
        simulationSettings,
        this.store.get(modelFactoriesAtom).labelManager,
      );
    };
  }

  /** @deprecated Use useModelTransaction hook instead */
  useTransactDeprecated() {
    return (moment: ModelMoment) => {
      const get = this.store.get;
      const set = this.store.set;

      const momentLog = get(momentLogAtom).copy();
      const currentMapSyncMoment = get(mapSyncMomentAtom);

      const isTruncatingHistory = momentLog.nextRedo() !== null;

      trackMoment(moment);
      const {
        note,
        deleteAssets,
        putAssets,
        patchAssetsAttributes,
        ...optionalFields
      } = moment;
      const forwardMoment: ModelMoment = {
        note,
        deleteAssets: deleteAssets || [],
        putAssets: putAssets || [],
        patchAssetsAttributes: patchAssetsAttributes || [],
        ...optionalFields,
      };
      const newStateId = nanoid();

      const reverseMoment = applyMoment(get, set, newStateId, forwardMoment);

      momentLog.append(forwardMoment, reverseMoment, newStateId);

      const newMapSyncMoment = computeSyncMoment(
        currentMapSyncMoment,
        momentLog,
        isTruncatingHistory,
      );

      set(momentLogAtom, momentLog);
      set(mapSyncMomentAtom, newMapSyncMoment);
      syncSnapshotMomentLog(get, set, momentLog, newStateId);
      updateModelCache(get, set);
    };
  }

  /** @deprecated Use useUndoableTransactions hook instead */
  useHistoryControlDeprecated() {
    return (direction: "undo" | "redo") => {
      const get = this.store.get;
      const set = this.store.set;

      const isUndo = direction === "undo";
      const momentLog = get(momentLogAtom).copy();
      const currentMapSyncMoment = get(mapSyncMomentAtom);
      const action = isUndo ? momentLog.nextUndo() : momentLog.nextRedo();
      if (!action) return;

      applyMoment(get, set, action.stateId, action.moment);

      isUndo ? momentLog.undo() : momentLog.redo();

      const newMapSyncMoment = computeSyncMoment(
        currentMapSyncMoment,
        momentLog,
      );

      set(momentLogAtom, momentLog);
      set(mapSyncMomentAtom, newMapSyncMoment);
      syncSnapshotMomentLog(get, set, momentLog, action.stateId);
      updateModelCache(get, set);
    };
  }

  deleteSnapshotFromCache(snapshotId: string): void {
    const cache = new Map(this.store.get(modelCacheAtom));
    cache.delete(snapshotId);
    this.store.set(modelCacheAtom, cache);
  }

  syncSnapshotSimulation(simulation: SimulationState): void {
    const worktree = this.store.get(worktreeAtom);
    const snapshot = worktree.snapshots.get(worktree.activeSnapshotId);
    if (!snapshot) return;

    const updatedSnapshots = new Map(worktree.snapshots);
    updatedSnapshots.set(worktree.activeSnapshotId, {
      ...snapshot,
      simulation,
      simulationSourceId: worktree.activeSnapshotId,
    });

    this.store.set(worktreeAtom, { ...worktree, snapshots: updatedSnapshots });
  }

  private switchMomentLog(momentLog: MomentLog): void {
    const current = this.store.get(mapSyncMomentAtom);
    this.store.set(momentLogAtom, momentLog);
    this.store.set(mapSyncMomentAtom, {
      pointer: momentLog.getPointer(),
      version: current.version + 1,
    });
  }

  private setModelVersion(version: string): void {
    const hydraulicModel = this.store.get(stagingModelAtom);
    this.store.set(stagingModelAtom, {
      ...hydraulicModel,
      version,
    });
  }

  async applySnapshot(worktree: Worktree, snapshotId: string): Promise<void> {
    const snapshot = worktree.snapshots.get(snapshotId);
    if (!snapshot) return;

    const currentSimulation = this.store.get(simulationAtom);
    const preserveTimestepIndex =
      currentSimulation.status === "success" ||
      currentSimulation.status === "warning"
        ? currentSimulation.currentTimestepIndex
        : undefined;

    const { model: stagingModel, labelManager: snapshotLabelManager } =
      this.getOrBuildModel(worktree, snapshotId);
    const { model: baseModel } = this.getOrBuildModel(
      worktree,
      worktree.mainId,
    );

    const simulation = getSimulationForState(worktree, initialSimulationState);
    const resultsSourceId = snapshot.simulationSourceId;
    const { resultsReader, actualTimestepIndex } =
      await this.loadSimulationResults(
        simulation,
        resultsSourceId,
        preserveTimestepIndex,
      );

    const finalSimulation =
      actualTimestepIndex !== undefined &&
      (simulation.status === "success" || simulation.status === "warning")
        ? { ...simulation, currentTimestepIndex: actualTimestepIndex }
        : simulation;

    const currentFactories = this.store.get(modelFactoriesAtom);
    this.store.set(stagingModelAtom, stagingModel);
    this.store.set(baseModelAtom, baseModel);
    this.store.set(
      modelFactoriesAtom,
      initializeModelFactories({
        idGenerator: currentFactories.idGenerator,
        labelManager: snapshotLabelManager,
        defaults: this.store.get(projectSettingsAtom).defaults,
        labelCounters: currentFactories.labelCounters,
      }),
    );
    this.switchMomentLog(snapshot.momentLog);
    this.setModelVersion(snapshot.version);
    this.store.set(simulationAtom, finalSimulation);
    this.store.set(simulationResultsAtom, resultsReader);
    this.store.set(simulationSettingsAtom, snapshot.simulationSettings);

    const selection = this.store.get(selectionAtom);
    const validatedSelection = USelection.clearInvalidIds(
      selection,
      stagingModel.assets,
      stagingModel.customerPoints,
    );
    this.store.set(selectionAtom, { ...validatedSelection });
  }

  private async loadSimulationResults(
    simulation: SimulationState,
    snapshotId: string,
    preserveTimestepIndex?: number,
  ): Promise<{
    resultsReader: Awaited<
      ReturnType<
        import("src/simulation").EPSResultsReader["getResultsForTimestep"]
      >
    > | null;
    actualTimestepIndex?: number;
  }> {
    if (
      (simulation.status === "success" || simulation.status === "warning") &&
      simulation.metadata
    ) {
      const [{ OPFSStorage }, { EPSResultsReader }, { getAppId }] =
        await Promise.all([
          import("src/infra/storage"),
          import("src/simulation"),
          import("src/infra/app-instance"),
        ]);

      const appId = getAppId();
      const storage = new OPFSStorage(appId, snapshotId);
      const epsReader = new EPSResultsReader(storage);
      await epsReader.initialize(simulation.metadata, simulation.simulationIds);

      let timestepIndex: number;
      if (preserveTimestepIndex !== undefined) {
        timestepIndex = Math.min(
          preserveTimestepIndex,
          epsReader.timestepCount - 1,
        );
      } else {
        timestepIndex = simulation.currentTimestepIndex ?? 0;
      }

      const resultsReader =
        await epsReader.getResultsForTimestep(timestepIndex);
      return { resultsReader, actualTimestepIndex: timestepIndex };
    }
    return { resultsReader: null };
  }

  private getOrBuildModel(
    worktree: Worktree,
    snapshotId: string,
  ): { model: HydraulicModel; labelManager: LabelManager } {
    const cache = this.store.get(modelCacheAtom);
    const cached = cache.get(snapshotId);
    if (cached) {
      return cached;
    }

    const result = this.buildModelFromDeltas(worktree, snapshotId);
    const updatedCache = new Map(cache);
    updatedCache.set(snapshotId, result);
    this.store.set(modelCacheAtom, updatedCache);

    return result;
  }

  private buildModelFromDeltas(
    worktree: Worktree,
    snapshotId: string,
  ): { model: HydraulicModel; labelManager: LabelManager } {
    const snapshot = worktree.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }

    const mainSnapshot = worktree.snapshots.get(worktree.mainId);
    const mainHasNoDeltas =
      mainSnapshot !== undefined && mainSnapshot.deltas.length === 0;

    const factories = this.store.get(modelFactoriesAtom);
    const labelManager = new LabelManager(factories.labelCounters);

    if (mainHasNoDeltas) {
      const baseModel = this.store.get(baseModelAtom);
      const model = { ...baseModel };

      const allDeltas = [...snapshot.deltas, ...snapshot.momentLog.getDeltas()];

      for (const delta of allDeltas) {
        applyMomentToModel(model, delta, labelManager);
      }

      return { model, labelManager };
    }

    const allDeltas: ModelMoment[] = [];
    let current: Snapshot | undefined = snapshot;

    while (current) {
      allDeltas.unshift(...current.deltas);
      current = current.parentId
        ? worktree.snapshots.get(current.parentId)
        : undefined;
    }

    const momentLogDeltas = snapshot.momentLog.getDeltas();
    allDeltas.push(...momentLogDeltas);

    const model = initializeHydraulicModel({
      idGenerator: factories.idGenerator,
    });

    for (const delta of allDeltas) {
      applyMomentToModel(model, delta, labelManager);
    }

    return { model, labelManager };
  }

  private resetWorktree(
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

    this.store.set(worktreeAtom, worktree);

    const cache = new Map<
      string,
      { model: HydraulicModel; labelManager: LabelManager }
    >();
    const importedModel = this.store.get(stagingModelAtom);
    cache.set("main", { model: importedModel, labelManager });
    this.store.set(modelCacheAtom, cache);
  }
}
