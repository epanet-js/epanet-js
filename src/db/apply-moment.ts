import type { HydraulicModel } from "src/hydraulic-model";
import type { ModelMoment } from "src/hydraulic-model/model-operation";
import type { Asset } from "src/hydraulic-model/asset-types";
import type { AssetId } from "src/hydraulic-model/asset-types/base-asset";
import { getDbWorker } from "./get-db-worker";
import { assetsToRows } from "./set-all-assets";
import type { AssetRows } from "./rows";

export type ApplyMomentPayload = {
  deleteIds: AssetId[];
  upserts: AssetRows;
};

export const buildMomentPayload = (
  moment: ModelMoment,
  postApplyModel: HydraulicModel,
): ApplyMomentPayload => {
  const upsertIds = new Set<AssetId>();
  for (const asset of moment.putAssets ?? []) upsertIds.add(asset.id);
  for (const patch of moment.patchAssetsAttributes ?? []) {
    upsertIds.add(patch.id);
  }

  const upsertAssets: Asset[] = [];
  for (const id of upsertIds) {
    const asset = postApplyModel.assets.get(id);
    if (asset) upsertAssets.push(asset);
  }

  return {
    deleteIds: [...(moment.deleteAssets ?? [])],
    upserts: assetsToRows(upsertAssets),
  };
};

export const applyMomentToDb = async (
  moment: ModelMoment,
  postApplyModel: HydraulicModel,
): Promise<void> => {
  const payload = buildMomentPayload(moment, postApplyModel);
  if (
    payload.deleteIds.length === 0 &&
    payload.upserts.junctions.length === 0 &&
    payload.upserts.reservoirs.length === 0 &&
    payload.upserts.tanks.length === 0 &&
    payload.upserts.pipes.length === 0 &&
    payload.upserts.pumps.length === 0 &&
    payload.upserts.valves.length === 0
  ) {
    return;
  }

  const worker = getDbWorker();
  await worker.applyMoment(payload);
};
