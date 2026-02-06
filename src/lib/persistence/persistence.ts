import type { IWrappedFeatureInput } from "src/types";
import once from "lodash/once";
import type { IPersistenceWithSnapshots } from "src/lib/persistence/ipersistence";
import { EMPTY_MOMENT, MomentInput, Moment } from "src/lib/persistence/moment";
import { generateKeyBetween } from "fractional-indexing";
import { worktreeAtom } from "src/state/scenarios";
import type {
  Worktree,
  Branch,
  Version,
  Snapshot,
} from "src/lib/worktree/types";
import {
  getActiveBranch,
  getBranch,
  getHeadVersion,
  getVersion,
} from "src/lib/worktree/helpers";
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
import { ModelMetadata } from "src/model-metadata";
import { MomentLog } from "./moment-log";
import { Mode } from "src/state/mode";
import { getSimulationForState } from "src/lib/worktree";

import {
  linkSymbologyAtom,
  nodeSymbologyAtom,
  savedSymbologiesAtom,
} from "src/state/symbology";
import { nullSymbologySpec } from "src/map/symbology";
import { mapSyncMomentAtom, MomentPointer } from "src/state/map";

const MAX_CHANGES_BEFORE_MAP_SYNC = 500;
const MAIN_BRANCH_ID = "main";

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
        putCurves: [...hydraulicModel.curvesDeprecated.values()],
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

      this.resetWorktree(snapshotMoment, hydraulicModel, momentLog);
    };
  }

  useInitializeBlank() {
    return (hydraulicModel: HydraulicModel, modelMetadata: ModelMetadata) => {
      this.store.set(splitsAtom, defaultSplits);
      this.store.set(stagingModelAtom, hydraulicModel);
      this.store.set(baseModelAtom, hydraulicModel);
      this.store.set(dataAtom, {
        ...nullData,
        folderMap: new Map(),
        modelMetadata,
      });
      this.store.set(momentLogAtom, new MomentLog());
      this.store.set(mapSyncMomentAtom, { pointer: -1, version: 0 });
      this.store.set(simulationAtom, initialSimulationState);
      this.store.set(nodeSymbologyAtom, nullSymbologySpec.node);
      this.store.set(linkSymbologyAtom, nullSymbologySpec.link);
      this.store.set(savedSymbologiesAtom, new Map());
      this.store.set(modeAtom, { mode: Mode.NONE });
      this.store.set(ephemeralStateAtom, { type: "none" });
      this.store.set(selectionAtom, { type: "none" });
      this.store.set(pipeDrawingDefaultsAtom, {});

      this.initializeWorktree(hydraulicModel);
    };
  }

  initializeWorktree(hydraulicModel: HydraulicModel): void {
    const versionId = nanoid();

    const snapshot: Snapshot = { versionId, hydraulicModel };

    const draftVersion: Version = {
      id: versionId,
      message: "",
      deltas: [],
      parentId: null,
      status: "draft",
      timestamp: Date.now(),
      snapshot,
    };

    const mainBranch: Branch = {
      id: MAIN_BRANCH_ID,
      name: "Main",
      headRevisionId: versionId,
      simulation: initialSimulationState,
      sessionHistory: new MomentLog(),
      draftVersionId: versionId,
    };

    const worktree: Worktree = {
      activeBranchId: MAIN_BRANCH_ID,
      lastActiveBranchId: MAIN_BRANCH_ID,
      branches: new Map([[MAIN_BRANCH_ID, mainBranch]]),
      versions: new Map([[versionId, draftVersion]]),
      highestScenarioNumber: 0,
    };

    this.store.set(worktreeAtom, worktree);
    this.modelCache.clear();
    this.modelCache.set(MAIN_BRANCH_ID, hydraulicModel);
  }

  private resetWorktree(
    moment: Moment,
    hydraulicModel: HydraulicModel,
    momentLog: MomentLog,
  ): void {
    const versionId = nanoid();

    const snapshot: Snapshot = { versionId, hydraulicModel };

    const draftVersion: Version = {
      id: versionId,
      message: "Import",
      deltas: [moment],
      parentId: null,
      status: "draft",
      timestamp: Date.now(),
      snapshot,
    };

    const mainBranch: Branch = {
      id: MAIN_BRANCH_ID,
      name: "Main",
      headRevisionId: versionId,
      simulation: initialSimulationState,
      sessionHistory: momentLog,
      draftVersionId: versionId,
    };

    const worktree: Worktree = {
      activeBranchId: MAIN_BRANCH_ID,
      lastActiveBranchId: MAIN_BRANCH_ID,
      branches: new Map([[MAIN_BRANCH_ID, mainBranch]]),
      versions: new Map([[versionId, draftVersion]]),
      highestScenarioNumber: 0,
    };

    this.store.set(worktreeAtom, worktree);
    this.modelCache.clear();
    this.modelCache.set(MAIN_BRANCH_ID, hydraulicModel);
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
      this.syncBranchSessionHistory(momentLog, newStateId);
      this.updateCacheAfterTransact();
    };
  }

  private updateCacheAfterTransact(): void {
    const worktree = this.store.get(worktreeAtom);
    const updatedModel = this.store.get(stagingModelAtom);
    this.modelCache.set(worktree.activeBranchId, updatedModel);
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
      this.syncBranchSessionHistory(momentLog, action.stateId);
      this.updateCacheAfterTransact();
    };
  }

  deleteBranchFromCache(branchId: string): void {
    this.modelCache.delete(branchId);
  }

  // Keep old name for backwards compatibility
  deleteSnapshotFromCache(snapshotId: string): void {
    this.deleteBranchFromCache(snapshotId);
  }

  getMomentLog(): MomentLog {
    return this.store.get(momentLogAtom);
  }

  getSimulation(): SimulationState {
    return this.store.get(simulationAtom);
  }

  private syncBranchSessionHistory(
    sessionHistory: MomentLog,
    _version: string,
  ): void {
    const worktree = this.store.get(worktreeAtom);
    const branch = getActiveBranch(worktree);
    if (!branch) return;

    const updatedBranches = new Map(worktree.branches);
    updatedBranches.set(worktree.activeBranchId, {
      ...branch,
      sessionHistory,
    });

    const updatedVersions = new Map(worktree.versions);
    if (branch.draftVersionId) {
      const draft = worktree.versions.get(branch.draftVersionId);
      if (draft) {
        const isOwnDraft = branch.headRevisionId === branch.draftVersionId;
        const snapshot = isOwnDraft ? sessionHistory.getSnapshot() : null;
        const sessionDeltas = sessionHistory.getDeltas();
        const deltas = snapshot
          ? [snapshot.moment, ...sessionDeltas]
          : sessionDeltas;
        updatedVersions.set(branch.draftVersionId, {
          ...draft,
          deltas,
        });
      }
    }

    this.store.set(worktreeAtom, {
      ...worktree,
      branches: updatedBranches,
      versions: updatedVersions,
    });
  }

  syncBranchSimulation(simulation: SimulationState): void {
    const worktree = this.store.get(worktreeAtom);
    const branch = getActiveBranch(worktree);
    if (!branch) return;

    const updatedBranches = new Map(worktree.branches);
    updatedBranches.set(worktree.activeBranchId, {
      ...branch,
      simulation,
    });

    this.store.set(worktreeAtom, { ...worktree, branches: updatedBranches });
  }

  // Keep old name for backwards compatibility
  syncSnapshotSimulation(simulation: SimulationState): void {
    this.syncBranchSimulation(simulation);
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

  async applyBranch(worktree: Worktree, branchId: string): Promise<void> {
    const branch = getBranch(worktree, branchId);
    if (!branch) return;

    const version = getHeadVersion(worktree, branchId);
    if (!version) return;

    const currentSimulation = this.store.get(simulationAtom);
    const preserveTimestepIndex =
      currentSimulation.status === "success" ||
      currentSimulation.status === "warning"
        ? currentSimulation.currentTimestepIndex
        : undefined;

    const stagingModel = this.getOrBuildModel(worktree, branchId);
    const baseModel = this.getOrBuildModel(worktree, MAIN_BRANCH_ID);
    const simulation = getSimulationForState(worktree, initialSimulationState);
    const { resultsReader, actualTimestepIndex } =
      await this.loadSimulationResults(
        simulation,
        branchId,
        preserveTimestepIndex,
      );

    const finalSimulation =
      actualTimestepIndex !== undefined &&
      (simulation.status === "success" || simulation.status === "warning")
        ? { ...simulation, currentTimestepIndex: actualTimestepIndex }
        : simulation;

    this.store.set(stagingModelAtom, stagingModel);
    this.store.set(baseModelAtom, baseModel);
    this.switchMomentLog(branch.sessionHistory);
    this.setModelVersion(version.id);
    this.store.set(simulationAtom, finalSimulation);
    this.store.set(simulationResultsAtom, resultsReader);
  }

  // Keep old name for backwards compatibility
  async applySnapshot(worktree: Worktree, branchId: string): Promise<void> {
    return this.applyBranch(worktree, branchId);
  }

  private async loadSimulationResults(
    simulation: SimulationState,
    branchId: string,
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
      const storage = new OPFSStorage(appId, branchId);
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
    branchId: string,
  ): HydraulicModel {
    const cached = this.modelCache.get(branchId);
    if (cached) {
      return cached;
    }

    const model = this.buildModelFromDeltas(worktree, branchId);
    this.modelCache.set(branchId, model);
    return model;
  }

  private buildModelFromDeltas(
    worktree: Worktree,
    branchId: string,
  ): HydraulicModel {
    const branch = getBranch(worktree, branchId);
    if (!branch) {
      throw new Error(`Branch ${branchId} not found`);
    }

    const draftVersion = branch.draftVersionId
      ? getVersion(worktree, branch.draftVersionId)
      : null;

    const startVersion = draftVersion ?? getHeadVersion(worktree, branchId);
    if (!startVersion) {
      throw new Error(`No version found for branch ${branchId}`);
    }

    const allDeltas: Moment[] = [];
    let currentVersion: Version | undefined = startVersion;

    while (currentVersion) {
      allDeltas.unshift(...currentVersion.deltas);
      currentVersion = currentVersion.parentId
        ? getVersion(worktree, currentVersion.parentId)
        : undefined;
    }

    if (!draftVersion) {
      const sessionHistoryDeltas = branch.sessionHistory.getDeltas();
      allDeltas.push(...sessionHistoryDeltas);
    }

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
      (forwardMoment.putCustomerPoints || []).length > 0
        ? new Map(hydraulicModel.customerPoints)
        : hydraulicModel.customerPoints;

    const updatedCurves =
      forwardMoment.putCurves && forwardMoment.putCurves.length > 0
        ? new Map(hydraulicModel.curvesDeprecated)
        : hydraulicModel.curvesDeprecated;

    this.store.set(stagingModelAtom, {
      ...updatedHydraulicModel,
      version: stateId,
      customerPoints: updatedCustomerPoints,
      curvesDeprecated: updatedCurves,
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
