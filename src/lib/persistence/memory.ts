import type {
  IFolder,
  IFolderInput,
  IWrappedFeature,
  IWrappedFeatureInput,
} from "src/types";
import once from "lodash/once";
import type {
  IPersistence,
  MetaPair,
  MetaUpdatesInput,
} from "src/lib/persistence/ipersistence";
import {
  fMoment,
  UMoment,
  EMPTY_MOMENT,
  MomentInput,
  Moment,
} from "src/lib/persistence/moment";
import { generateKeyBetween } from "fractional-indexing";
import {
  Data,
  dataAtom,
  memoryMetaAtom,
  Store,
  momentLogAtom,
  nullData,
  simulationAtom,
} from "src/state/jotai";
import {
  getFreshAt,
  momentForDeleteFeatures,
  momentForDeleteFolders,
  trackMoment,
  trackMomentDeprecated,
} from "./shared";
import { IDMap, UIDMap } from "src/lib/id_mapper";
import { sortAts } from "src/lib/parse_stored";
import { AssetsMap, HydraulicModel } from "src/hydraulic-model";
import { ModelMoment } from "src/hydraulic-model";
import { Asset, LinkAsset } from "src/hydraulic-model";
import { nanoid } from "nanoid";
import { ModelMetadata } from "src/model-metadata";
import { MomentLog } from "./moment-log";

export class MemPersistence implements IPersistence {
  idMap: IDMap;
  private store: Store;
  constructor(idMap: IDMap, store: Store) {
    this.idMap = idMap;
    this.store = store;
  }
  putPresence = async () => {};

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
        deleteFeatures: [],
        putFeatures: moment.putAssets,
      };
      moment.putAssets.forEach((asset) => {
        UIDMap.pushUUID(this.idMap, asset.id);
        hydraulicModel.assetBuilder.labelManager.register(
          asset.label,
          asset.id,
        );
      });
      momentLog.setSnapshot(forwardMoment, hydraulicModel.version);
      this.store.set(dataAtom, {
        ...nullData,
        folderMap: new Map(),
        hydraulicModel,
        modelMetadata,
      });
      this.store.set(momentLogAtom, momentLog);
      this.store.set(simulationAtom, { status: "idle" });
    };
  }
  useTransact() {
    return (moment: ModelMoment) => {
      const momentLog = this.store.get(momentLogAtom).copy();
      trackMoment(moment);
      const forwardMoment = {
        ...EMPTY_MOMENT,
        note: moment.note,
        deleteFeatures: moment.deleteAssets || [],
        putFeatures: moment.putAssets || [],
      };
      const newStateId = nanoid();

      const reverseMoment = this.apply(newStateId, forwardMoment);

      momentLog.append(forwardMoment, reverseMoment, newStateId);

      this.store.set(momentLogAtom, momentLog);
    };
  }

  useTransactDeprecated() {
    return (partialMoment: Partial<MomentInput>) => {
      const momentLog = this.store.get(momentLogAtom).copy();
      trackMomentDeprecated(partialMoment);
      const forwardMoment: MomentInput = {
        ...EMPTY_MOMENT,
        ...partialMoment,
      };
      const newStateId = nanoid();

      const reverseMoment = this.apply(newStateId, forwardMoment);
      momentLog.append(forwardMoment as Moment, reverseMoment);
      this.store.set(momentLogAtom, momentLog);
      return Promise.resolve();
    };
  }

  useLastPresence() {
    return null;
  }

  useMetadata(): MetaPair {
    const meta = this.store.get(memoryMetaAtom);
    return [
      {
        type: "memory",
        ...meta,
      },
      (updates: MetaUpdatesInput) => {
        this.store.set(memoryMetaAtom, (meta) => {
          return {
            ...meta,
            ...updates,
          };
        });
        return Promise.resolve();
      },
    ];
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
    const reverseMoment = UMoment.merge(
      fMoment(forwardMoment.note || `Reverse`),
      this.deleteFeaturesInner(forwardMoment.deleteFeatures, ctx),
      this.deleteFoldersInner(forwardMoment.deleteFolders, ctx),
      this.putFeaturesInner(forwardMoment.putFeatures, ctx),
      this.putFoldersInner(forwardMoment.putFolders, ctx),
    );

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
  private deleteFeaturesInner(
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
      hydraulicModel.assetBuilder.labelManager.remove(asset.label, asset.id);
    }
    return moment;
  }

  private deleteFoldersInner(folders: readonly IFolder["id"][], ctx: Data) {
    const moment = momentForDeleteFolders(folders, ctx);
    for (const id of folders) {
      ctx.folderMap.delete(id);
    }
    return moment;
  }

  private putFoldersInner(folders: IFolderInput[], ctx: Data) {
    const moment = fMoment("Put folders");

    let lastAt: string | null = null;

    for (const inputFolder of folders) {
      const oldVersion = ctx.folderMap.get(inputFolder.id);
      if (inputFolder.at === undefined) {
        if (!lastAt) lastAt = getFreshAt(ctx);
        const at = generateKeyBetween(lastAt, null);
        lastAt = at;
        inputFolder.at = at;
      }

      if (oldVersion) {
        moment.putFolders.push(oldVersion);
      } else {
        moment.deleteFolders.push(inputFolder.id);
      }
      ctx.folderMap.set(inputFolder.id, inputFolder as IFolder);
    }

    return moment;
  }

  private putFeaturesInner(features: IWrappedFeatureInput[], ctx: Data) {
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
        reverseMoment.putFeatures.push(oldVersion);
      } else {
        reverseMoment.deleteFeatures.push(inputFeature.id);
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
        ctx.hydraulicModel.assetBuilder.labelManager.remove(
          oldVersion.label,
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

      ctx.hydraulicModel.assetBuilder.labelManager.register(
        (inputFeature as Asset).label,
        inputFeature.id,
      );
      UIDMap.pushUUID(this.idMap, inputFeature.id);
    }

    return reverseMoment;
  }
}
