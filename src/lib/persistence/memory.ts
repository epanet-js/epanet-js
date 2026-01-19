import type { IWrappedFeature, IWrappedFeatureInput } from "src/types";
import once from "lodash/once";
import type { IPersistence } from "src/lib/persistence/ipersistence";
import {
  fMoment,
  UMoment,
  EMPTY_MOMENT,
  MomentInput,
  Moment,
} from "src/lib/persistence/moment";
import type { ScenariosState, Scenario } from "src/state/scenarios";
import type { SimulationState } from "src/state/jotai";
import { generateKeyBetween } from "fractional-indexing";
import {
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
} from "src/state/jotai";
import { getFreshAt, momentForDeleteFeatures, trackMoment } from "./shared";
import { sortAts } from "src/lib/parse-stored";
import {
  HydraulicModel,
  updateHydraulicModelAssets,
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

export class MemPersistence implements IPersistence {
  private store: Store;
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
      const moment = {
        note: `Import ${name}`,
        putAssets: [...hydraulicModel.assets.values()],
      };
      trackMoment(moment);
      const forwardMoment = {
        ...EMPTY_MOMENT,
        note: moment.note,
        deleteAssets: [],
        putAssets: moment.putAssets,
      };
      moment.putAssets.forEach((asset) => {
        hydraulicModel.labelManager.register(asset.label, asset.type, asset.id);
        if (asset.isLink) {
          hydraulicModel.assetIndex.addLink(asset.id);
        } else if (asset.isNode) {
          hydraulicModel.assetIndex.addNode(asset.id);
        }
      });
      momentLog.setSnapshot(forwardMoment, hydraulicModel.version);
      this.store.set(splitsAtom, defaultSplits);
      this.store.set(dataAtom, {
        ...nullData,
        folderMap: new Map(),
        hydraulicModel,
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
    };
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
    };
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
    };
  }

  getMomentLog(): MomentLog {
    return this.store.get(momentLogAtom);
  }

  captureModelSnapshot(): { moment: Moment; stateId: string } {
    const ctx = this.store.get(dataAtom);
    const { hydraulicModel } = ctx;

    const moment: Moment = {
      note: "Scenario base snapshot",
      putAssets: [...hydraulicModel.assets.values()],
      deleteAssets: [],
      putDemands: hydraulicModel.demands,
      putEPSTiming: hydraulicModel.epsTiming,
      putControls: hydraulicModel.controls,
      putCustomerPoints: [...hydraulicModel.customerPoints.values()],
      putCurves: [...hydraulicModel.curves.values()],
    };

    return { moment, stateId: hydraulicModel.version };
  }

  applySnapshot(
    moment: MomentInput,
    stateId: string,
    mergeAssetsAndSettings = false,
  ): void {
    const current = this.store.get(mapSyncMomentAtom);

    this.apply(stateId, moment, mergeAssetsAndSettings);

    this.store.set(mapSyncMomentAtom, {
      pointer: -1,
      version: current.version + 1,
    });
  }

  switchMomentLog(momentLog: MomentLog): void {
    const current = this.store.get(mapSyncMomentAtom);
    this.store.set(momentLogAtom, momentLog);
    this.store.set(mapSyncMomentAtom, {
      pointer: momentLog.getPointer(),
      version: current.version + 1,
    });
  }

  restoreToBase(baseSnapshot: { moment: Moment; stateId: string }): void {
    const ctx = this.store.get(dataAtom);
    const { hydraulicModel } = ctx;

    const currentAssetIds = [...hydraulicModel.assets.keys()];
    const baseAssetIds = new Set(
      baseSnapshot.moment.putAssets.map((a) => a.id),
    );

    const assetsToDelete = currentAssetIds.filter(
      (id) => !baseAssetIds.has(id),
    );

    for (const id of assetsToDelete) {
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

    this.applySnapshot(baseSnapshot.moment, baseSnapshot.stateId, true);
  }

  getModelVersion(): string {
    const ctx = this.store.get(dataAtom);
    return ctx.hydraulicModel.version;
  }

  setModelVersion(version: string): void {
    const ctx = this.store.get(dataAtom);
    this.store.set(dataAtom, {
      ...ctx,
      hydraulicModel: {
        ...ctx.hydraulicModel,
        version,
      },
    });
  }

  switchToMainScenario(
    currentState: ScenariosState,
    getCurrentSimulation: () => SimulationState,
  ): ScenariosState {
    if (currentState.activeScenarioId === null) {
      return currentState;
    }

    const currentScenario = currentState.scenarios.get(currentState.activeScenarioId);
    const updatedScenarios = new Map(currentState.scenarios);
    if (currentScenario) {
      updatedScenarios.set(currentState.activeScenarioId, {
        ...currentScenario,
        momentLog: this.getMomentLog(),
        simulation: getCurrentSimulation(),
        modelVersion: this.getModelVersion(),
      });
    }

    if (currentState.baseModelSnapshot) {
      this.restoreToBase(currentState.baseModelSnapshot);
    }

    if (currentState.mainMomentLog) {
      const deltas = currentState.mainMomentLog.getDeltas();
      for (const delta of deltas) {
        this.applySnapshot(delta, "");
      }
      this.switchMomentLog(currentState.mainMomentLog);
    }

    if (currentState.mainModelVersion) {
      this.setModelVersion(currentState.mainModelVersion);
    }

    return {
      ...currentState,
      scenarios: updatedScenarios,
      activeScenarioId: null,
    };
  }

  switchToScenario(
    currentState: ScenariosState,
    scenarioId: string,
    getCurrentSimulation: () => SimulationState,
  ): ScenariosState {
    if (currentState.activeScenarioId === scenarioId) {
      return currentState;
    }

    const scenario = currentState.scenarios.get(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }

    const isMainActive = currentState.activeScenarioId === null;
    const updatedScenarios = new Map(currentState.scenarios);

    let newState = { ...currentState, scenarios: updatedScenarios };

    if (isMainActive) {
      newState.mainMomentLog = this.getMomentLog();
      newState.mainSimulation = getCurrentSimulation();
      newState.mainModelVersion = this.getModelVersion();
    } else {
      const currentScenario = currentState.scenarios.get(currentState.activeScenarioId!);
      if (currentScenario) {
        updatedScenarios.set(currentState.activeScenarioId!, {
          ...currentScenario,
          momentLog: this.getMomentLog(),
          simulation: getCurrentSimulation(),
          modelVersion: this.getModelVersion(),
        });
      }
    }

    if (currentState.baseModelSnapshot) {
      this.restoreToBase(currentState.baseModelSnapshot);
    }

    const deltas = scenario.momentLog.getDeltas();
    for (const delta of deltas) {
      this.applySnapshot(delta, "");
    }
    this.switchMomentLog(scenario.momentLog);
    this.setModelVersion(scenario.modelVersion);

    return {
      ...newState,
      activeScenarioId: scenarioId,
    };
  }

  createScenario(
    currentState: ScenariosState,
    scenarioFactory: (state: ScenariosState) => Scenario,
    getCurrentSimulation: () => SimulationState,
  ): { state: ScenariosState; scenarioId: string; scenarioName: string } {
    let baseSnapshot = currentState.baseModelSnapshot;
    if (!baseSnapshot) {
      baseSnapshot = this.captureModelSnapshot();
    }

    const isMainActive = currentState.activeScenarioId === null;

    const mainMomentLog = isMainActive
      ? this.getMomentLog()
      : currentState.mainMomentLog;

    const mainSimulation = isMainActive
      ? getCurrentSimulation()
      : currentState.mainSimulation;

    const mainModelVersion = isMainActive
      ? this.getModelVersion()
      : currentState.mainModelVersion;

    const updatedScenarios = new Map(currentState.scenarios);

    if (!isMainActive) {
      const currentScenario = currentState.scenarios.get(currentState.activeScenarioId!);
      if (currentScenario) {
        updatedScenarios.set(currentState.activeScenarioId!, {
          ...currentScenario,
          momentLog: this.getMomentLog(),
          simulation: getCurrentSimulation(),
          modelVersion: this.getModelVersion(),
        });
      }
    }

    const newScenario = scenarioFactory({
      ...currentState,
      baseModelSnapshot: baseSnapshot,
    });

    const newMomentLog = new MomentLog();
    newMomentLog.setSnapshot(baseSnapshot.moment, baseSnapshot.stateId);

    const finalScenario = {
      ...newScenario,
      momentLog: newMomentLog,
    };

    this.restoreToBase(baseSnapshot);
    this.switchMomentLog(newMomentLog);
    this.setModelVersion(baseSnapshot.stateId);

    updatedScenarios.set(finalScenario.id, finalScenario);

    return {
      scenarioId: finalScenario.id,
      scenarioName: finalScenario.name,
      state: {
        ...currentState,
        scenarios: updatedScenarios,
        highestScenarioNumber: finalScenario.number,
        activeScenarioId: finalScenario.id,
        baseModelSnapshot: baseSnapshot,
        mainMomentLog,
        mainSimulation,
        mainModelVersion,
      },
    };
  }

  deleteScenario(
    currentState: ScenariosState,
    scenarioId: string,
    getCurrentSimulation: () => SimulationState,
  ): ScenariosState {
    const scenarioToDelete = currentState.scenarios.get(scenarioId);
    if (!scenarioToDelete) {
      return currentState;
    }

    const remainingScenarios = Array.from(currentState.scenarios.values())
      .filter((s) => s.id !== scenarioId)
      .sort((a, b) => a.createdAt - b.createdAt);

    const isDeletedActive = currentState.activeScenarioId === scenarioId;

    if (remainingScenarios.length === 0) {
      if (currentState.baseModelSnapshot) {
        this.restoreToBase(currentState.baseModelSnapshot);
      }

      if (currentState.mainMomentLog) {
        const deltas = currentState.mainMomentLog.getDeltas();
        for (const delta of deltas) {
          this.applySnapshot(delta, "");
        }
        this.switchMomentLog(currentState.mainMomentLog);
      }

      if (currentState.mainModelVersion) {
        this.setModelVersion(currentState.mainModelVersion);
      }

      return {
        ...currentState,
        scenarios: new Map(),
        activeScenarioId: null,
        baseModelSnapshot: null,
        mainMomentLog: null,
        mainSimulation: null,
        mainModelVersion: null,
        highestScenarioNumber: 0,
      };
    }

    if (isDeletedActive) {
      const nextScenario = remainingScenarios[0];

      if (currentState.baseModelSnapshot) {
        this.restoreToBase(currentState.baseModelSnapshot);
      }

      const deltas = nextScenario.momentLog.getDeltas();
      for (const delta of deltas) {
        this.applySnapshot(delta, "");
      }
      this.switchMomentLog(nextScenario.momentLog);
      this.setModelVersion(nextScenario.modelVersion);

      const updatedScenarios = new Map(currentState.scenarios);
      updatedScenarios.delete(scenarioId);

      return {
        ...currentState,
        scenarios: updatedScenarios,
        activeScenarioId: nextScenario.id,
      };
    }

    const updatedScenarios = new Map(currentState.scenarios);
    updatedScenarios.delete(scenarioId);

    return {
      ...currentState,
      scenarios: updatedScenarios,
    };
  }

  getSimulationForState(
    state: ScenariosState,
    initialSimulationState: SimulationState,
  ): SimulationState {
    if (state.activeScenarioId === null) {
      return state.mainSimulation ?? initialSimulationState;
    }
    const scenario = state.scenarios.get(state.activeScenarioId);
    return scenario?.simulation ?? initialSimulationState;
  }

  /**
   * This could and should be improved. It does do some weird stuff:
   * we need to write to the moment log and to features.
   */
  private apply(
    stateId: string,
    forwardMoment: MomentInput,
    mergeAssetsAndSettings = false,
  ) {
    const ctx = this.store.get(dataAtom);
    let reverseMoment;

    const hasSettings =
      forwardMoment.putDemands ||
      forwardMoment.putEPSTiming ||
      forwardMoment.putControls;

    if (mergeAssetsAndSettings || !hasSettings) {
      const assetReverseMoment = UMoment.merge(
        fMoment(forwardMoment.note || `Reverse`),
        this.deleteAssetsInner(forwardMoment.deleteAssets, ctx),
        this.putAssetsInner(forwardMoment.putAssets, ctx),
        this.putCustomerPointsInner(forwardMoment.putCustomerPoints || [], ctx),
        this.putCurvesInner(forwardMoment.putCurves, ctx),
      );

      if (mergeAssetsAndSettings && hasSettings) {
        reverseMoment = {
          ...assetReverseMoment,
          putDemands: forwardMoment.putDemands
            ? ctx.hydraulicModel.demands
            : undefined,
          putEPSTiming: forwardMoment.putEPSTiming
            ? ctx.hydraulicModel.epsTiming
            : undefined,
          putControls: forwardMoment.putControls
            ? ctx.hydraulicModel.controls
            : undefined,
        };
      } else {
        reverseMoment = assetReverseMoment;
      }
    } else {
      reverseMoment = {
        note: "Reverse simulation settings",
        putDemands: forwardMoment.putDemands
          ? ctx.hydraulicModel.demands
          : undefined,
        putEPSTiming: forwardMoment.putEPSTiming
          ? ctx.hydraulicModel.epsTiming
          : undefined,
        putControls: forwardMoment.putControls
          ? ctx.hydraulicModel.controls
          : undefined,
        putAssets: [],
        deleteAssets: [],
      };
    }

    const updatedHydraulicModel = updateHydraulicModelAssets(
      ctx.hydraulicModel,
    );

    const updatedCustomerPoints =
      (forwardMoment.putCustomerPoints || []).length > 0
        ? new Map(ctx.hydraulicModel.customerPoints)
        : ctx.hydraulicModel.customerPoints;

    const updatedCurves =
      forwardMoment.putCurves && forwardMoment.putCurves.length > 0
        ? new Map(ctx.hydraulicModel.curves)
        : ctx.hydraulicModel.curves;

    this.store.set(dataAtom, {
      selection: ctx.selection,
      hydraulicModel: {
        ...updatedHydraulicModel,
        version: stateId,
        demands: forwardMoment.putDemands
          ? forwardMoment.putDemands
          : ctx.hydraulicModel.demands,
        epsTiming: forwardMoment.putEPSTiming
          ? forwardMoment.putEPSTiming
          : ctx.hydraulicModel.epsTiming,
        controls: forwardMoment.putControls
          ? forwardMoment.putControls
          : ctx.hydraulicModel.controls,
        customerPoints: updatedCustomerPoints,
        customerPointsLookup: ctx.hydraulicModel.customerPointsLookup,
        curves: updatedCurves,
      },
      folderMap: new Map(
        Array.from(ctx.folderMap).sort((a, b) => {
          return sortAts(a[1], b[1]);
        }),
      ),
      modelMetadata: ctx.modelMetadata,
    });
    return reverseMoment;
  }

  // PRIVATE --------------------------------------------
  //
  /**
   * Inner workings of delete features. Beware,
   * changes ctx by reference.
   *
   * @param features input features
   * @param ctx MUTATED
   * @returns new moment
   */
  private deleteAssetsInner(
    features: readonly IWrappedFeature["id"][],
    ctx: Data,
  ) {
    const moment = momentForDeleteFeatures(features, ctx);
    const { hydraulicModel } = ctx;
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

  private putAssetsInner(features: IWrappedFeatureInput[], ctx: Data) {
    const reverseMoment = fMoment("Put features");
    const ats = once(() =>
      Array.from(
        ctx.hydraulicModel.assets.values(),
        (wrapped) => wrapped.at,
      ).sort(),
    );
    const atsSet = once(() => new Set(ats()));

    let lastAt: string | null = null;

    for (const inputFeature of features) {
      const oldVersion = ctx.hydraulicModel.assets.get(inputFeature.id);
      if (inputFeature.at === undefined) {
        if (!lastAt) lastAt = getFreshAt(ctx);
        const at = generateKeyBetween(lastAt, null);
        lastAt = at;
        inputFeature.at = at;
      }

      if (oldVersion) {
        reverseMoment.putAssets.push(oldVersion);
      } else {
        reverseMoment.deleteAssets.push(inputFeature.id);
        // If we're inserting a new feature but its
        // at value is already in the set, find it a
        // new value at the start
        if (atsSet().has(inputFeature.at)) {
          inputFeature.at = generateKeyBetween(null, ats()[0]);
        }
      }

      const {
        hydraulicModel: { assets, topology },
      } = ctx;
      assets.set(inputFeature.id, inputFeature as Asset);

      const assetToIndex = inputFeature as Asset;
      if (assetToIndex.isLink) {
        ctx.hydraulicModel.assetIndex.addLink(assetToIndex.id);
      } else if (assetToIndex.isNode) {
        ctx.hydraulicModel.assetIndex.addNode(assetToIndex.id);
      }

      if (oldVersion && topology.hasLink(oldVersion.id)) {
        const oldLink = oldVersion as LinkAsset;
        const oldConnections = oldLink.connections;

        oldConnections && topology.removeLink(oldVersion.id);
        ctx.hydraulicModel.labelManager.remove(
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

      ctx.hydraulicModel.labelManager.register(
        (inputFeature as Asset).label,
        (inputFeature as Asset).type,
        (inputFeature as Asset).id,
      );
    }

    return reverseMoment;
  }

  private putCustomerPointsInner(customerPoints: CustomerPoint[], ctx: Data) {
    const reverseMoment = {
      note: "Put customer points",
      putCustomerPoints: [] as CustomerPoint[],
      putAssets: [],
      deleteAssets: [],
    };

    const lookup = ctx.hydraulicModel.customerPointsLookup;

    for (const customerPoint of customerPoints) {
      const oldVersion = ctx.hydraulicModel.customerPoints.get(
        customerPoint.id,
      );
      if (oldVersion) {
        reverseMoment.putCustomerPoints.push(oldVersion);

        lookup.removeConnection(oldVersion);
      }

      lookup.addConnection(customerPoint);

      ctx.hydraulicModel.customerPoints.set(customerPoint.id, customerPoint);
    }

    return reverseMoment;
  }

  private putCurvesInner(curves: ICurve[] | undefined, ctx: Data) {
    const reverseMoment = fMoment("Reverse curves");

    if (!curves || curves.length === 0)
      return { putAssets: [], deleteAssets: [] };

    const reverseCurves: ICurve[] = [];

    for (const newCurve of curves) {
      const oldCurve = ctx.hydraulicModel.curves.get(newCurve.id);
      if (oldCurve) {
        reverseCurves.push(oldCurve);
      }
      ctx.hydraulicModel.curves.set(newCurve.id, newCurve);
    }

    if (reverseCurves.length > 0) {
      reverseMoment.putCurves = reverseCurves;
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
