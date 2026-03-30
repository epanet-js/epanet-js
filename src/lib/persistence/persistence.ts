import type { IWrappedFeatureInput } from "src/types";
import once from "lodash/once";
import type { IPersistenceWithSnapshots } from "src/lib/persistence/ipersistence";
import { MomentInput, Moment } from "src/lib/persistence/moment";
import { generateKeyBetween } from "fractional-indexing";
import { worktreeAtom } from "src/state/scenarios";
import type { Snapshot, Worktree } from "src/lib/worktree/types";
import { Data, dataAtom, nullData } from "src/state/data";
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
import { getFreshAt, trackMoment } from "./shared";
import { sortAts } from "src/lib/parse-stored";
import {
  HydraulicModel,
  updateHydraulicModelAssets,
  initializeHydraulicModel,
  applyMomentToModel,
} from "src/hydraulic-model";
import { ModelMoment } from "src/hydraulic-model";
import { Asset } from "src/hydraulic-model";
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
import { mapSyncMomentAtom, MomentPointer } from "src/state/map";
import { USelection } from "src/selection";
import { toDemandAssignments } from "src/hydraulic-model/model-operation";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import { simulationSettingsAtom } from "src/state/simulation-settings";
import {
  ModelFactories,
  initializeModelFactories,
} from "src/hydraulic-model/factories";
import { modelFactoriesAtom } from "src/state/model-factories";
import type { IdGenerator } from "src/lib/id-generator";
import type { Projection } from "src/lib/projections/projection";
import { createProjectionMapper } from "src/lib/projections";
import { transformCoordinates } from "src/hydraulic-model/mutations/transform-coordinates";

const MAX_CHANGES_BEFORE_MAP_SYNC = 500;

export class Persistence implements IPersistenceWithSnapshots {
  private store: Store;
  private modelCache = new Map<string, HydraulicModel>();

  constructor(store: Store) {
    this.store = store;
  }
  useTransactImport() {
    return (
      hydraulicModel: HydraulicModel,
      factories: ModelFactories,
      idGenerator: IdGenerator,
      projectSettings: ProjectSettings,
      name: string,
      simulationSettings: SimulationSettings,
      options?: { autoElevations?: boolean },
    ) => {
      const momentLog = new MomentLog();

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
        hydraulicModel.labelManager.register(asset.label, asset.type, asset.id);
        if (asset.isLink) {
          hydraulicModel.assetIndex.addLink(asset.id);
        } else if (asset.isNode) {
          hydraulicModel.assetIndex.addNode(asset.id);
        }
      });

      hydraulicModel.customerPoints.forEach((cp) => {
        hydraulicModel.labelManager.register(cp.label, "customerPoint", cp.id);
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
        idGenerator,
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
      const snapshotMoment: Moment = {
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
        this.store.get(worktreeAtom).idGenerator,
      );
    };
  }

  private resetWorktree(
    moment: Moment,
    version: string,
    momentLog: MomentLog,
    simulationSettings: SimulationSettings,
    idGenerator: IdGenerator,
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

    const labelCounters: Worktree["labelCounters"] = new Map();

    const worktree: Worktree = {
      activeSnapshotId: "main",
      lastActiveSnapshotId: "main",
      snapshots: new Map([["main", mainSnapshot]]),
      mainId: "main",
      scenarios: [],
      highestScenarioNumber: 0,
      labelCounters,
      idGenerator,
    };

    this.store.set(worktreeAtom, worktree);

    this.modelCache.clear();
    const importedModel = this.store.get(stagingModelAtom);
    importedModel.labelManager.adoptCounters(labelCounters);
    this.modelCache.set("main", importedModel);
  }

  useTransact() {
    return (moment: ModelMoment) => {
      const momentLog = this.store.get(momentLogAtom).copy();
      const mapSyncMoment = this.store.get(mapSyncMomentAtom);

      const isTruncatingHistory = momentLog.nextRedo() !== null;

      trackMoment(moment);
      const {
        note,
        deleteAssets,
        putAssets,
        patchAssetsAttributes,
        ...optionalFields
      } = moment;
      const forwardMoment: Moment = {
        note,
        deleteAssets: deleteAssets || [],
        putAssets: putAssets || [],
        patchAssetsAttributes: patchAssetsAttributes || [],
        ...optionalFields,
      };
      const newStateId = nanoid();

      const reverseMoment = this.apply(newStateId, forwardMoment);

      momentLog.append(forwardMoment, reverseMoment, newStateId);

      const newMapSyncMoment = this.computeSyncMoment(
        mapSyncMoment,
        momentLog,
        isTruncatingHistory,
      );

      this.store.set(momentLogAtom, momentLog);
      this.store.set(mapSyncMomentAtom, newMapSyncMoment);
      this.syncSnapshotMomentLog(momentLog, newStateId);
      this.updateCacheAfterTransact();
    };
  }

  private updateCacheAfterTransact(): void {
    const worktree = this.store.get(worktreeAtom);
    const updatedModel = this.store.get(stagingModelAtom);
    this.modelCache.set(worktree.activeSnapshotId, updatedModel);
  }

  useHistoryControl() {
    return (direction: "undo" | "redo") => {
      const isUndo = direction === "undo";
      const momentLog = this.store.get(momentLogAtom).copy();
      const mapSyncMoment = this.store.get(mapSyncMomentAtom);
      const action = isUndo ? momentLog.nextUndo() : momentLog.nextRedo();
      if (!action) return;

      this.apply(action.stateId, action.moment);

      isUndo ? momentLog.undo() : momentLog.redo();

      const newMapSyncMoment = this.computeSyncMoment(mapSyncMoment, momentLog);

      this.store.set(momentLogAtom, momentLog);
      this.store.set(mapSyncMomentAtom, newMapSyncMoment);
      this.syncSnapshotMomentLog(momentLog, action.stateId);
      this.updateCacheAfterTransact();
    };
  }

  deleteSnapshotFromCache(snapshotId: string): void {
    this.modelCache.delete(snapshotId);
  }

  getMomentLog(): MomentLog {
    return this.store.get(momentLogAtom);
  }

  getSimulation(): SimulationState {
    return this.store.get(simulationAtom);
  }

  private syncSnapshotMomentLog(momentLog: MomentLog, version: string): void {
    const worktree = this.store.get(worktreeAtom);
    const snapshot = worktree.snapshots.get(worktree.activeSnapshotId);
    if (!snapshot) return;

    const updatedSnapshots = new Map(worktree.snapshots);
    updatedSnapshots.set(worktree.activeSnapshotId, {
      ...snapshot,
      momentLog,
      version,
    });

    this.store.set(worktreeAtom, { ...worktree, snapshots: updatedSnapshots });
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

  getModelVersion(): string {
    const hydraulicModel = this.store.get(stagingModelAtom);
    return hydraulicModel.version;
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

    const stagingModel = this.getOrBuildModel(worktree, snapshotId);
    const baseModel = this.getOrBuildModel(worktree, worktree.mainId);
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

    this.store.set(stagingModelAtom, stagingModel);
    this.store.set(baseModelAtom, baseModel);
    this.store.set(
      modelFactoriesAtom,
      initializeModelFactories({
        idGenerator: worktree.idGenerator,
        labelManager: stagingModel.labelManager,
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
  ): HydraulicModel {
    const cached = this.modelCache.get(snapshotId);
    if (cached) {
      return cached;
    }

    const model = this.buildModelFromDeltas(worktree, snapshotId);
    this.modelCache.set(snapshotId, model);
    return model;
  }

  private buildModelFromDeltas(
    worktree: Worktree,
    snapshotId: string,
  ): HydraulicModel {
    const snapshot = worktree.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }

    const allDeltas: Moment[] = [];
    let current: Snapshot | undefined = snapshot;

    while (current) {
      allDeltas.unshift(...current.deltas);
      current = current.parentId
        ? worktree.snapshots.get(current.parentId)
        : undefined;
    }

    const momentLogDeltas = snapshot.momentLog.getDeltas();
    allDeltas.push(...momentLogDeltas);

    const { defaults } = this.store.get(projectSettingsAtom);
    const model = initializeHydraulicModel({
      defaults,
      idGenerator: worktree.idGenerator,
      labelCounters: worktree.labelCounters,
    });

    for (const delta of allDeltas) {
      applyMomentToModel(model, delta as ModelMoment);
    }

    return model;
  }

  private apply(stateId: string, forwardMoment: MomentInput) {
    const ctx = this.store.get(dataAtom);
    const hydraulicModel = this.store.get(stagingModelAtom);

    const processedMoment: ModelMoment = {
      ...forwardMoment,
      note: forwardMoment.note || "Update",
      putAssets: this.ensureAtValues(
        forwardMoment.putAssets,
        hydraulicModel,
        ctx,
      ),
    };

    const reverseMoment = applyMomentToModel(hydraulicModel, processedMoment);

    const updatedHydraulicModel = updateHydraulicModelAssets(hydraulicModel);

    const updatedCustomerPoints =
      (forwardMoment.putCustomerPoints || []).length > 0 ||
      (forwardMoment.deleteCustomerPoints || []).length > 0
        ? new Map(hydraulicModel.customerPoints)
        : hydraulicModel.customerPoints;

    const updatedCurves =
      forwardMoment.putCurves && forwardMoment.putCurves.size > 0
        ? new Map(hydraulicModel.curves)
        : hydraulicModel.curves;

    this.store.set(stagingModelAtom, {
      ...updatedHydraulicModel,
      version: stateId,
      customerPoints: updatedCustomerPoints,
      curves: updatedCurves,
    });
    this.store.set(dataAtom, {
      selection: ctx.selection,
      folderMap: new Map(
        Array.from(ctx.folderMap).sort((a, b) => {
          return sortAts(a[1], b[1]);
        }),
      ),
    });
    return reverseMoment;
  }

  private ensureAtValues(
    features: IWrappedFeatureInput[],
    hydraulicModel: HydraulicModel,
    ctx: Data,
  ): Asset[] {
    if (!features || features.length === 0) return [];

    const ats = once(() =>
      Array.from(
        hydraulicModel.assets.values(),
        (wrapped) => wrapped.at,
      ).sort(),
    );
    const atsSet = once(() => new Set(ats()));

    let lastAt: string | null = null;

    for (const inputFeature of features) {
      const isNew = !hydraulicModel.assets.has(inputFeature.id);

      if (inputFeature.at === undefined) {
        if (!lastAt) lastAt = getFreshAt(ctx, hydraulicModel);
        const at = generateKeyBetween(lastAt, null);
        lastAt = at;
        inputFeature.at = at;
      }

      if (isNew && atsSet().has(inputFeature.at)) {
        inputFeature.at = generateKeyBetween(null, ats()[0]);
      }
    }

    return features as Asset[];
  }

  private exceedsMaxChangesSinceLastSync(
    momentLog: MomentLog,
    lastSyncPointer: number,
  ): boolean {
    const deltasSinceLastSync = momentLog.getDeltas(lastSyncPointer);
    const editedAssetsCount = deltasSinceLastSync.reduce(
      (count, moment) =>
        count +
        moment.deleteAssets.length +
        moment.putAssets.length +
        moment.patchAssetsAttributes.length,
      0,
    );
    return editedAssetsCount > MAX_CHANGES_BEFORE_MAP_SYNC;
  }

  private computeSyncMoment(
    current: MomentPointer,
    momentLog: MomentLog,
    force: boolean = false,
  ): MomentPointer {
    if (
      force ||
      this.exceedsMaxChangesSinceLastSync(momentLog, current.pointer)
    ) {
      return {
        pointer: momentLog.getPointer(),
        version: current.version + 1,
      };
    }
    return current;
  }
}
