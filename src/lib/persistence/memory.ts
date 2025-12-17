import type { IWrappedFeature, IWrappedFeatureInput } from "src/types";
import once from "lodash/once";
import type { IPersistence } from "src/lib/persistence/ipersistence";
import {
  fMoment,
  UMoment,
  EMPTY_MOMENT,
  MomentInput,
} from "src/lib/persistence/moment";
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
import { mapSnapshotPointerAtom, MapSnapshotPointer } from "src/state/map";

const MAX_CHANGES_BEFORE_SNAPSHOT = 500;

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
      this.store.set(mapSnapshotPointerAtom, { pointer: -1, version: 0 });
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
      const mapSnapshotPointer = this.store.get(mapSnapshotPointerAtom);

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

      const newSnapshotPointer = this.computeSnapshotPointer(
        mapSnapshotPointer,
        momentLog,
        isTruncatingHistory,
      );

      this.store.set(momentLogAtom, momentLog);
      this.store.set(mapSnapshotPointerAtom, newSnapshotPointer);
    };
  }

  useHistoryControl() {
    return (direction: "undo" | "redo") => {
      const isUndo = direction === "undo";
      const momentLog = this.store.get(momentLogAtom).copy();
      const mapSnapshotPointer = this.store.get(mapSnapshotPointerAtom);
      const action = isUndo ? momentLog.nextUndo() : momentLog.nextRedo();
      if (!action) return;

      this.apply(action.stateId, action.moment);

      isUndo ? momentLog.undo() : momentLog.redo();

      const newSnapshotPointer = this.computeSnapshotPointer(
        mapSnapshotPointer,
        momentLog,
      );

      this.store.set(momentLogAtom, momentLog);
      this.store.set(mapSnapshotPointerAtom, newSnapshotPointer);
    };
  }
  /**
   * This could and should be improved. It does do some weird stuff:
   * we need to write to the moment log and to features.
   */
  private apply(stateId: string, forwardMoment: MomentInput) {
    const ctx = this.store.get(dataAtom);
    let reverseMoment;
    if (
      forwardMoment.putDemands ||
      forwardMoment.putEPSTiming ||
      forwardMoment.putControls
    ) {
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
    } else {
      reverseMoment = UMoment.merge(
        fMoment(forwardMoment.note || `Reverse`),
        this.deleteAssetsInner(forwardMoment.deleteAssets, ctx),
        this.putAssetsInner(forwardMoment.putAssets, ctx),
        this.putCustomerPointsInner(forwardMoment.putCustomerPoints || [], ctx),
        this.putCurvesInner(forwardMoment.putCurves, ctx),
      );
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

  private exceedsMaxChangesSinceSnapshot(
    momentLog: MomentLog,
    snapshotPointer: number,
  ): boolean {
    const deltasFromSnapshot = momentLog.getDeltasFrom(snapshotPointer);
    const editedAssetsCount = deltasFromSnapshot.reduce(
      (count, moment) =>
        count + moment.deleteAssets.length + moment.putAssets.length,
      0,
    );
    return editedAssetsCount > MAX_CHANGES_BEFORE_SNAPSHOT;
  }

  private computeSnapshotPointer(
    current: MapSnapshotPointer,
    momentLog: MomentLog,
    force: boolean = false,
  ): MapSnapshotPointer {
    if (
      force ||
      this.exceedsMaxChangesSinceSnapshot(momentLog, current.pointer)
    ) {
      return {
        pointer: momentLog.getPointer(),
        version: current.version + 1,
      };
    }
    return current;
  }
}
