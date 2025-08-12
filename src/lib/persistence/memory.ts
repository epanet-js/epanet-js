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
} from "src/state/jotai";
import { getFreshAt, momentForDeleteFeatures, trackMoment } from "./shared";
import { IDMap, UIDMap } from "src/lib/id-mapper";
import { sortAts } from "src/lib/parse-stored";
import { AssetsMap, HydraulicModel } from "src/hydraulic-model";
import { ModelMoment } from "src/hydraulic-model";
import { Asset, LinkAsset } from "src/hydraulic-model";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { nanoid } from "nanoid";
import { ModelMetadata } from "src/model-metadata";
import { MomentLog } from "./moment-log";

import {
  linkSymbologyAtom,
  nodeSymbologyAtom,
  savedSymbologiesAtom,
} from "src/state/symbology";
import { nullSymbologySpec } from "src/map/symbology";

export class MemPersistence implements IPersistence {
  idMap: IDMap;
  private store: Store;
  constructor(idMap: IDMap, store: Store) {
    this.idMap = idMap;
    this.store = store;
  }
  useTransactImport() {
    return (
      hydraulicModel: HydraulicModel,
      modelMetadata: ModelMetadata,
      name: string,
    ) => {
      this.idMap = UIDMap.empty();

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
        UIDMap.pushUUID(this.idMap, asset.id);
        hydraulicModel.labelManager.register(asset.label, asset.type, asset.id);
      });
      momentLog.setSnapshot(forwardMoment, hydraulicModel.version);
      this.store.set(dataAtom, {
        ...nullData,
        folderMap: new Map(),
        hydraulicModel,
        modelMetadata,
      });
      this.store.set(momentLogAtom, momentLog);
      this.store.set(simulationAtom, initialSimulationState);
      this.store.set(nodeSymbologyAtom, nullSymbologySpec.node);
      this.store.set(linkSymbologyAtom, nullSymbologySpec.link);
      this.store.set(savedSymbologiesAtom, new Map());
    };
  }

  useTransact() {
    return (moment: ModelMoment) => {
      const momentLog = this.store.get(momentLogAtom).copy();
      trackMoment(moment);
      const forwardMoment = {
        ...EMPTY_MOMENT,
        note: moment.note,
        deleteAssets: moment.deleteAssets || [],
        putAssets: moment.putAssets || [],
        putDemands: moment.putDemands,
        putCustomerPoints: moment.putCustomerPoints,
      };
      const newStateId = nanoid();

      const reverseMoment = this.apply(newStateId, forwardMoment);

      momentLog.append(forwardMoment, reverseMoment, newStateId);

      this.store.set(momentLogAtom, momentLog);
    };
  }

  useHistoryControl() {
    return (direction: "undo" | "redo") => {
      const isUndo = direction === "undo";
      const momentLog = this.store.get(momentLogAtom).copy();
      const action = isUndo ? momentLog.nextUndo() : momentLog.nextRedo();
      if (!action) return;

      this.apply(action.stateId, action.moment);

      isUndo ? momentLog.undo() : momentLog.redo();

      this.store.set(momentLogAtom, momentLog);
    };
  }
  /**
   * This could and should be improved. It does do some weird stuff:
   * we need to write to the moment log and to features.
   */
  private apply(stateId: string, forwardMoment: MomentInput) {
    const ctx = this.store.get(dataAtom);
    let reverseMoment;
    if (forwardMoment.putDemands) {
      reverseMoment = {
        note: "Reverse demands",
        putDemands: ctx.hydraulicModel.demands,
        putAssets: [],
        deleteAssets: [],
      };
    } else if (forwardMoment.putCustomerPoints) {
      reverseMoment = this.putCustomerPointsInner(
        forwardMoment.putCustomerPoints,
        ctx,
      );
    } else {
      reverseMoment = UMoment.merge(
        fMoment(forwardMoment.note || `Reverse`),
        this.deleteAssetsInner(forwardMoment.deleteAssets, ctx),
        this.putAssetsInner(forwardMoment.putAssets, ctx),
      );
    }

    const updatedAssets = new AssetsMap(
      Array.from(ctx.hydraulicModel.assets).sort((a, b) => {
        return sortAts(a[1], b[1]);
      }),
    );

    this.store.set(dataAtom, {
      selection: ctx.selection,
      hydraulicModel: {
        ...ctx.hydraulicModel,
        version: stateId,
        assets: updatedAssets,
        demands: forwardMoment.putDemands
          ? forwardMoment.putDemands
          : ctx.hydraulicModel.demands,
        customerPoints: ctx.hydraulicModel.customerPoints,
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
      UIDMap.pushUUID(this.idMap, inputFeature.id);
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

    for (const customerPoint of customerPoints) {
      const oldVersion = ctx.hydraulicModel.customerPoints.get(
        customerPoint.id,
      );
      if (oldVersion) {
        reverseMoment.putCustomerPoints.push(oldVersion);
      }

      ctx.hydraulicModel.customerPoints.set(customerPoint.id, customerPoint);
    }

    return reverseMoment;
  }
}
