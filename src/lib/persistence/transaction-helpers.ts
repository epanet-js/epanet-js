import once from "lodash/once";
import { generateKeyBetween } from "fractional-indexing";
import type { Getter, Setter } from "jotai";
import {
  type HydraulicModel,
  type ModelMoment,
  type Asset,
  updateHydraulicModelAssets,
  applyMomentToModel,
} from "src/hydraulic-model";
import { type Data, dataAtom } from "src/state/data";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { modelFactoriesAtom } from "src/state/model-factories";
import { worktreeAtom } from "src/state/scenarios";
import { modelCacheAtom } from "src/state/model-cache";
import { type MomentPointer } from "src/state/map";
import type { MomentLog } from "./moment-log";
import { getFreshAt } from "./shared";
import { sortAts } from "src/lib/parse-stored";

const MAX_CHANGES_BEFORE_MAP_SYNC = 500;

export function ensureAtValues(
  features: Asset[] | undefined,
  hydraulicModel: HydraulicModel,
  ctx: Data,
): Asset[] {
  if (!features || features.length === 0) return [];

  const ats = once(() =>
    Array.from(hydraulicModel.assets.values(), (wrapped) => wrapped.at).sort(),
  );
  const atsSet = once(() => new Set(ats()));

  let lastAt: string | null = null;

  for (const inputFeature of features) {
    const mutable = inputFeature as { at: string };
    const isNew = !hydraulicModel.assets.has(inputFeature.id);

    if (inputFeature.at === undefined) {
      if (!lastAt) lastAt = getFreshAt(ctx, hydraulicModel);
      const at = generateKeyBetween(lastAt, null);
      lastAt = at;
      mutable.at = at;
    }

    if (isNew && atsSet().has(inputFeature.at)) {
      mutable.at = generateKeyBetween(null, ats()[0]);
    }
  }

  return features;
}

export function applyMoment(
  get: Getter,
  set: Setter,
  stateId: string,
  forwardMoment: ModelMoment,
): ModelMoment {
  const ctx = get(dataAtom);
  const hydraulicModel = get(stagingModelAtom);

  const processedMoment: ModelMoment = {
    ...forwardMoment,
    note: forwardMoment.note || "Update",
    putAssets: ensureAtValues(forwardMoment.putAssets, hydraulicModel, ctx),
  };

  const factories = get(modelFactoriesAtom);
  const reverseMoment = applyMomentToModel(
    hydraulicModel,
    processedMoment,
    factories.labelManager,
  );

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

  set(stagingModelAtom, {
    ...updatedHydraulicModel,
    version: stateId,
    customerPoints: updatedCustomerPoints,
    curves: updatedCurves,
  });
  set(dataAtom, {
    selection: ctx.selection,
    folderMap: new Map(
      Array.from(ctx.folderMap).sort((a, b) => {
        return sortAts(a[1], b[1]);
      }),
    ),
  });
  return reverseMoment;
}

export function exceedsMaxChangesSinceLastSync(
  momentLog: MomentLog,
  lastSyncPointer: number,
): boolean {
  const deltasSinceLastSync = momentLog.getDeltas(lastSyncPointer);
  const editedAssetsCount = deltasSinceLastSync.reduce(
    (count, moment) =>
      count +
      (moment.deleteAssets?.length ?? 0) +
      (moment.putAssets?.length ?? 0) +
      (moment.patchAssetsAttributes?.length ?? 0),
    0,
  );
  return editedAssetsCount > MAX_CHANGES_BEFORE_MAP_SYNC;
}

export function computeSyncMoment(
  current: MomentPointer,
  momentLog: MomentLog,
  force: boolean = false,
): MomentPointer {
  if (force || exceedsMaxChangesSinceLastSync(momentLog, current.pointer)) {
    return {
      pointer: momentLog.getPointer(),
      version: current.version + 1,
    };
  }
  return current;
}

export function syncSnapshotMomentLog(
  get: Getter,
  set: Setter,
  momentLog: MomentLog,
  version: string,
): void {
  const worktree = get(worktreeAtom);
  const snapshot = worktree.snapshots.get(worktree.activeSnapshotId);
  if (!snapshot) return;

  const updatedSnapshots = new Map(worktree.snapshots);
  updatedSnapshots.set(worktree.activeSnapshotId, {
    ...snapshot,
    momentLog,
    version,
  });

  set(worktreeAtom, { ...worktree, snapshots: updatedSnapshots });
}

export function updateModelCache(get: Getter, set: Setter): void {
  const worktree = get(worktreeAtom);
  const updatedModel = get(stagingModelAtom);
  const factories = get(modelFactoriesAtom);
  const cache = new Map(get(modelCacheAtom));
  cache.set(worktree.activeSnapshotId, {
    model: updatedModel,
    labelManager: factories.labelManager,
  });
  set(modelCacheAtom, cache);
}
