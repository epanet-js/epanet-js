import type { IWrappedFeature, IWrappedFeatureInput } from "src/types";
import once from "lodash/once";
import type { IPersistenceWithSnapshots } from "src/lib/persistence/ipersistence";
import {
  fMoment,
  UMoment,
  EMPTY_MOMENT,
  MomentInput,
  Moment,
} from "src/lib/persistence/moment";
import { generateKeyBetween } from "fractional-indexing";
import { worktreeAtom } from "src/state/scenarios";
import type { Snapshot, Worktree } from "src/lib/worktree/types";
import {
  type SimulationState,
  Data,
  dataAtom,
  Store,
  momentLogAtom,
  nullData,
  simulationAtom,
  initialSimulationState,
  modeAtom,
  ephemeralStateAtom,
  selectionAtom,
  splitsAtom,
  defaultSplits,
  pipeDrawingDefaultsAtom,
  stagingModelAtom,
} from "src/state/jotai";
import { baseModelAtom } from "src/state/hydraulic-model";
import { getFreshAt, momentForDeleteFeatures, trackMoment } from "./shared";
import { sortAts } from "src/lib/parse-stored";
import {
  Demands,
  HydraulicModel,
  updateHydraulicModelAssets,
  initializeHydraulicModel,
  applyMomentToModel,
} from "src/hydraulic-model";
import { ModelMoment } from "src/hydraulic-model";
import { Asset, LinkAsset } from "src/hydraulic-model";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { ICurve } from "src/hydraulic-model/curves";
import { nanoid } from "nanoid";
import { ModelMetadata } from "src/model-metadata";
import { MomentLog } from "./moment-log";
import { Mode } from "src/state/mode";

import {
  linkSymbologyAtom,
  nodeSymbologyAtom,
  savedSymbologiesAtom,
} from "src/state/symbology";
import { nullSymbologySpec } from "src/map/symbology";
import { mapSyncMomentAtom, MomentPointer } from "src/state/map";

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
      modelMetadata: ModelMetadata,
      name: string,
    ) => {
      const momentLog = new MomentLog();

      const assets = [...hydraulicModel.assets.values()];

      const snapshotMoment: Moment = {
        note: `Import ${name}`,
        putAssets: assets,
        deleteAssets: [],
        putDemands: hydraulicModel.demands,
        putEPSTiming: hydraulicModel.epsTiming,
        putControls: hydraulicModel.controls,
        putCustomerPoints: [...hydraulicModel.customerPoints.values()],
        putCurves: [...hydraulicModel.curves.values()],
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

      momentLog.setSnapshot(snapshotMoment, hydraulicModel.version);
      this.store.set(splitsAtom, defaultSplits);
      this.store.set(stagingModelAtom, hydraulicModel);
      this.store.set(baseModelAtom, hydraulicModel);
      this.store.set(dataAtom, {
        ...nullData,
        folderMap: new Map(),
        modelMetadata,
      });
      this.store.set(momentLogAtom, momentLog);
      this.store.set(mapSyncMomentAtom, { pointer: -1, version: 0 });
      this.store.set(simulationAtom, initialSimulationState);
      this.store.set(nodeSymbologyAtom, nullSymbologySpec.node);
      this.store.set(linkSymbologyAtom, nullSymbologySpec.link);
      this.store.set(savedSymbologiesAtom, new Map());
      this.store.set(modeAtom, { mode: Mode.NONE });
      this.store.set(ephemeralStateAtom, { type: "none" });
      this.store.set(selectionAtom, { type: "none" });
      this.store.set(pipeDrawingDefaultsAtom, {});

      this.resetWorktree(snapshotMoment, hydraulicModel.version, momentLog);
    };
  }

  private resetWorktree(
    moment: Moment,
    version: string,
    momentLog: MomentLog,
  ): void {
    const mainSnapshot: Snapshot = {
      id: "main",
      name: "Main",
      parentId: null,
      deltas: [moment],
      version,
      momentLog,
      simulation: initialSimulationState,
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

    this.modelCache.clear();
    const importedModel = this.store.get(stagingModelAtom);
    this.modelCache.set("main", importedModel);
  }

  useTransact() {
    return (moment: ModelMoment) => {
      const momentLog = this.store.get(momentLogAtom).copy();
      const mapSyncMoment = this.store.get(mapSyncMomentAtom);

      const isTruncatingHistory = momentLog.nextRedo() !== null;

      trackMoment(moment);
      const forwardMoment = {
        ...EMPTY_MOMENT,
        note: moment.note,
        deleteAssets: moment.deleteAssets || [],
        putAssets: moment.putAssets || [],
        putDemands: moment.putDemands,
        putEPSTiming: moment.putEPSTiming,
        putControls: moment.putControls,
        putCustomerPoints: moment.putCustomerPoints,
        putCurves: moment.putCurves,
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
    if (worktree.scenarios.length === 0) return;

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
    if (worktree.scenarios.length === 0) return;

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
    if (worktree.scenarios.length === 0) return;

    const snapshot = worktree.snapshots.get(worktree.activeSnapshotId);
    if (!snapshot) return;

    const updatedSnapshots = new Map(worktree.snapshots);
    updatedSnapshots.set(worktree.activeSnapshotId, {
      ...snapshot,
      simulation,
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

  applySnapshot(worktree: Worktree, snapshotId: string): void {
    const snapshot = worktree.snapshots.get(snapshotId);
    if (!snapshot) return;

    const stagingModel = this.getOrBuildModel(worktree, snapshotId);
    this.store.set(stagingModelAtom, stagingModel);

    const baseModel = this.getOrBuildModel(worktree, worktree.mainId);
    this.store.set(baseModelAtom, baseModel);

    this.switchMomentLog(snapshot.momentLog);
    this.setModelVersion(snapshot.version);
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

    const ctx = this.store.get(dataAtom);
    const currentHydraulicModel = this.store.get(stagingModelAtom);
    const model = initializeHydraulicModel({
      units: currentHydraulicModel.units,
      defaults: ctx.modelMetadata.quantities.defaults,
      idGenerator: currentHydraulicModel.assetBuilder.idGenerator,
    });

    for (const delta of allDeltas) {
      applyMomentToModel(model, delta as ModelMoment);
    }

    return model;
  }

  private apply(
    stateId: string,
    forwardMoment: MomentInput,
    mergeAssetsAndSettings = false,
  ) {
    const ctx = this.store.get(dataAtom);
    const hydraulicModel = this.store.get(stagingModelAtom);
    let reverseMoment;

    const hasSettings = forwardMoment.putEPSTiming || forwardMoment.putControls;

    if (mergeAssetsAndSettings || !hasSettings) {
      const assetReverseMoment = UMoment.merge(
        fMoment(forwardMoment.note || `Reverse`),
        this.deleteAssetsInner(forwardMoment.deleteAssets, ctx, hydraulicModel),
        this.putAssetsInner(forwardMoment.putAssets, ctx, hydraulicModel),
        this.putCustomerPointsInner(
          forwardMoment.putCustomerPoints || [],
          hydraulicModel,
        ),
        this.putCurvesInner(forwardMoment.putCurves, hydraulicModel),
        this.putDemandsInner(forwardMoment.putDemands, hydraulicModel),
      );

      if (mergeAssetsAndSettings && hasSettings) {
        reverseMoment = {
          ...assetReverseMoment,
          putEPSTiming: forwardMoment.putEPSTiming
            ? hydraulicModel.epsTiming
            : undefined,
          putControls: forwardMoment.putControls
            ? hydraulicModel.controls
            : undefined,
        };
      } else {
        reverseMoment = assetReverseMoment;
      }
    } else {
      reverseMoment = {
        note: "Reverse simulation settings",
        putDemands: forwardMoment.putDemands
          ? hydraulicModel.demands
          : undefined,
        putEPSTiming: forwardMoment.putEPSTiming
          ? hydraulicModel.epsTiming
          : undefined,
        putControls: forwardMoment.putControls
          ? hydraulicModel.controls
          : undefined,
        putAssets: [],
        deleteAssets: [],
      };
    }

    const updatedHydraulicModel = updateHydraulicModelAssets(hydraulicModel);

    const updatedCustomerPoints =
      (forwardMoment.putCustomerPoints || []).length > 0
        ? new Map(hydraulicModel.customerPoints)
        : hydraulicModel.customerPoints;

    const updatedCurves =
      forwardMoment.putCurves && forwardMoment.putCurves.length > 0
        ? new Map(hydraulicModel.curves)
        : hydraulicModel.curves;

    this.store.set(stagingModelAtom, {
      ...updatedHydraulicModel,
      version: stateId,
      demands: forwardMoment.putDemands
        ? forwardMoment.putDemands
        : hydraulicModel.demands,
      epsTiming: forwardMoment.putEPSTiming
        ? forwardMoment.putEPSTiming
        : hydraulicModel.epsTiming,
      controls: forwardMoment.putControls
        ? forwardMoment.putControls
        : hydraulicModel.controls,
      customerPoints: updatedCustomerPoints,
      customerPointsLookup: hydraulicModel.customerPointsLookup,
      curves: updatedCurves,
    });
    this.store.set(dataAtom, {
      selection: ctx.selection,
      folderMap: new Map(
        Array.from(ctx.folderMap).sort((a, b) => {
          return sortAts(a[1], b[1]);
        }),
      ),
      modelMetadata: ctx.modelMetadata,
    });
    return reverseMoment;
  }

  private deleteAssetsInner(
    features: readonly IWrappedFeature["id"][],
    ctx: Data,
    hydraulicModel: HydraulicModel,
  ) {
    const moment = momentForDeleteFeatures(features, hydraulicModel);
    for (const id of features) {
      const asset = hydraulicModel.assets.get(id);
      if (!asset) continue;

      if (asset.isLink) {
        hydraulicModel.assetIndex.removeLink(asset.id);
      } else if (asset.isNode) {
        hydraulicModel.assetIndex.removeNode(asset.id);
      }

      hydraulicModel.assets.delete(id);
      hydraulicModel.topology.removeNode(id);
      hydraulicModel.topology.removeLink(id);
      hydraulicModel.labelManager.remove(asset.label, asset.type, asset.id);
    }
    return moment;
  }

  private putAssetsInner(
    features: IWrappedFeatureInput[],
    ctx: Data,
    hydraulicModel: HydraulicModel,
  ) {
    const reverseMoment = fMoment("Put features");
    const ats = once(() =>
      Array.from(
        hydraulicModel.assets.values(),
        (wrapped) => wrapped.at,
      ).sort(),
    );
    const atsSet = once(() => new Set(ats()));

    let lastAt: string | null = null;

    for (const inputFeature of features) {
      const oldVersion = hydraulicModel.assets.get(inputFeature.id);
      if (inputFeature.at === undefined) {
        if (!lastAt) lastAt = getFreshAt(ctx, hydraulicModel);
        const at = generateKeyBetween(lastAt, null);
        lastAt = at;
        inputFeature.at = at;
      }

      if (oldVersion) {
        reverseMoment.putAssets.push(oldVersion);
      } else {
        reverseMoment.deleteAssets.push(inputFeature.id);
        if (atsSet().has(inputFeature.at)) {
          inputFeature.at = generateKeyBetween(null, ats()[0]);
        }
      }

      const { assets, topology } = hydraulicModel;
      assets.set(inputFeature.id, inputFeature as Asset);

      const assetToIndex = inputFeature as Asset;
      if (assetToIndex.isLink) {
        hydraulicModel.assetIndex.addLink(assetToIndex.id);
      } else if (assetToIndex.isNode) {
        hydraulicModel.assetIndex.addNode(assetToIndex.id);
      }

      if (oldVersion && topology.hasLink(oldVersion.id)) {
        const oldLink = oldVersion as LinkAsset;
        const oldConnections = oldLink.connections;

        oldConnections && topology.removeLink(oldVersion.id);
        hydraulicModel.labelManager.remove(
          oldVersion.label,
          oldVersion.type,
          oldVersion.id,
        );
      }

      if (
        inputFeature.feature.properties &&
        (inputFeature as LinkAsset).connections
      ) {
        const [start, end] = (inputFeature as LinkAsset).connections;

        topology.addLink(inputFeature.id, start, end);
      }

      hydraulicModel.labelManager.register(
        (inputFeature as Asset).label,
        (inputFeature as Asset).type,
        (inputFeature as Asset).id,
      );
    }

    return reverseMoment;
  }

  private putCustomerPointsInner(
    customerPoints: CustomerPoint[],
    hydraulicModel: HydraulicModel,
  ) {
    const reverseMoment = {
      note: "Put customer points",
      putCustomerPoints: [] as CustomerPoint[],
      putAssets: [],
      deleteAssets: [],
    };

    const lookup = hydraulicModel.customerPointsLookup;

    for (const customerPoint of customerPoints) {
      const oldVersion = hydraulicModel.customerPoints.get(customerPoint.id);
      if (oldVersion) {
        reverseMoment.putCustomerPoints.push(oldVersion);

        lookup.removeConnection(oldVersion);
      }

      lookup.addConnection(customerPoint);

      hydraulicModel.customerPoints.set(customerPoint.id, customerPoint);
    }

    return reverseMoment;
  }

  private putCurvesInner(
    curves: ICurve[] | undefined,
    hydraulicModel: HydraulicModel,
  ) {
    const reverseMoment = fMoment("Reverse curves");

    if (!curves || curves.length === 0)
      return { putAssets: [], deleteAssets: [] };

    const reverseCurves: ICurve[] = [];

    for (const newCurve of curves) {
      const oldCurve = hydraulicModel.curves.get(newCurve.id);
      if (oldCurve) {
        reverseCurves.push(oldCurve);
      }
      hydraulicModel.curves.set(newCurve.id, newCurve);
    }

    if (reverseCurves.length > 0) {
      reverseMoment.putCurves = reverseCurves;
    }

    return reverseMoment;
  }

  private putDemandsInner(
    demands: Demands | undefined,
    hydraulicModel: HydraulicModel,
  ) {
    const reverseMoment = fMoment("Reverse demands");
    if (!demands) return reverseMoment;

    reverseMoment.putDemands = hydraulicModel.demands;

    for (const pattern of hydraulicModel.demands.patterns.values()) {
      hydraulicModel.labelManager.remove(pattern.label, "pattern", pattern.id);
    }
    hydraulicModel.demands = demands;
    for (const pattern of demands.patterns.values()) {
      hydraulicModel.labelManager.register(
        pattern.label,
        "pattern",
        pattern.id,
      );
    }

    return reverseMoment;
  }

  private exceedsMaxChangesSinceLastSync(
    momentLog: MomentLog,
    lastSyncPointer: number,
  ): boolean {
    const deltasSinceLastSync = momentLog.getDeltas(lastSyncPointer);
    const editedAssetsCount = deltasSinceLastSync.reduce(
      (count, moment) =>
        count + moment.deleteAssets.length + moment.putAssets.length,
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
