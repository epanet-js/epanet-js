import type {
  IFolder,
  IFolderInput,
  ILayerConfig,
  IWrappedFeature,
  IWrappedFeatureInput,
  LayerConfigMap,
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
  layerConfigAtom,
  memoryMetaAtom,
  Store,
  momentLogAtom,
} from "src/state/jotai";
import {
  getFreshAt,
  momentForDeleteFeatures,
  momentForDeleteFolders,
  momentForDeleteLayerConfigs,
  trackMoment,
  trackMomentDeprecated,
} from "./shared";
import { IDMap, UIDMap } from "src/lib/id_mapper";
import { sortAts } from "src/lib/parse_stored";
import { AssetsMap } from "src/hydraulic-model";
import { ModelMoment } from "src/hydraulic-model";
import { Asset, LinkAsset } from "src/hydraulic-model";

export class MemPersistence implements IPersistence {
  idMap: IDMap;
  private store: Store;
  constructor(idMap: IDMap, store: Store) {
    this.idMap = idMap;
    this.store = store;
  }
  putPresence = async () => {};

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

      const reverseMoment = this.apply(forwardMoment);

      momentLog.append(forwardMoment, reverseMoment);

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
      const reverseMoment = this.apply(forwardMoment);
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
      const moment = isUndo ? momentLog.nextUndo() : momentLog.nextRedo();
      if (!moment) return;

      this.apply(moment);

      isUndo ? momentLog.undo() : momentLog.redo();

      this.store.set(momentLogAtom, momentLog);
    };
  }
  /**
   * This could and should be improved. It does do some weird stuff:
   * we need to write to the moment log and to features.
   */
  private apply(forwardMoment: MomentInput) {
    const ctx = this.store.get(dataAtom);
    const layerConfigMap = this.store.get(layerConfigAtom);
    const reverseMoment = UMoment.merge(
      fMoment(forwardMoment.note || `Reverse`),
      this.deleteFeaturesInner(forwardMoment.deleteFeatures, ctx),
      this.deleteFoldersInner(forwardMoment.deleteFolders, ctx),
      this.putFeaturesInner(forwardMoment.putFeatures, ctx),
      this.putFoldersInner(forwardMoment.putFolders, ctx),
      this.putLayerConfigsInner(forwardMoment.putLayerConfigs, layerConfigMap),
      this.deleteLayerConfigsInner(
        forwardMoment.deleteLayerConfigs,
        layerConfigMap,
      ),
    );

    const updatedFeatures = new AssetsMap(
      Array.from(ctx.hydraulicModel.assets).sort((a, b) => {
        return sortAts(a[1], b[1]);
      }),
    );
    this.store.set(dataAtom, {
      selection: ctx.selection,
      hydraulicModel: {
        ...ctx.hydraulicModel,
        assets: updatedFeatures,
      },
      featureMapDeprecated: updatedFeatures,
      folderMap: new Map(
        Array.from(ctx.folderMap).sort((a, b) => {
          return sortAts(a[1], b[1]);
        }),
      ),
    });
    if (
      forwardMoment.putLayerConfigs?.length ||
      forwardMoment.deleteLayerConfigs?.length
    ) {
      this.store.set(
        layerConfigAtom,
        new Map(
          Array.from(layerConfigMap).sort((a, b) => {
            return sortAts(a[1], b[1]);
          }),
        ),
      );
    }
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
      hydraulicModel.assets.delete(id);
      hydraulicModel.topology.removeNode(id);
      hydraulicModel.topology.removeLink(id);
    }
    return moment;
  }

  private deleteLayerConfigsInner(
    layerConfigs: readonly ILayerConfig["id"][],
    layerConfigMap: LayerConfigMap,
  ) {
    const moment = momentForDeleteLayerConfigs(layerConfigs, layerConfigMap);
    for (const id of layerConfigs) {
      layerConfigMap.delete(id);
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
        ctx.featureMapDeprecated.values(),
        (wrapped) => wrapped.at,
      ).sort(),
    );
    const atsSet = once(() => new Set(ats()));

    let lastAt: string | null = null;

    for (const inputFeature of features) {
      const oldVersion = ctx.featureMapDeprecated.get(inputFeature.id);
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
      }

      if (
        inputFeature.feature.properties &&
        (inputFeature as LinkAsset).connections
      ) {
        const [start, end] = (inputFeature as LinkAsset).connections;

        topology.addLink(inputFeature.id, start, end);
      }

      UIDMap.pushUUID(this.idMap, inputFeature.id);
    }

    return reverseMoment;
  }

  private putLayerConfigsInner(
    layerConfigs: ILayerConfig[],
    layerConfigMap: LayerConfigMap,
  ) {
    const moment = fMoment("Put layer configs");

    for (const layerConfig of layerConfigs) {
      const oldVersion = layerConfigMap.get(layerConfig.id);
      if (oldVersion) {
        moment.putLayerConfigs.push(oldVersion);
      } else {
        moment.deleteLayerConfigs.push(layerConfig.id);
      }
      layerConfigMap.set(layerConfig.id, layerConfig);
    }

    return moment;
  }
}
