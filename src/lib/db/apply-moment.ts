import type { HydraulicModel } from "src/hydraulic-model";
import type { ModelMoment } from "src/hydraulic-model/model-operation";
import type { Asset } from "src/hydraulic-model/asset-types";
import type { AssetId } from "src/hydraulic-model/asset-types/base-asset";
import type { CustomerPointId } from "src/hydraulic-model/customer-points";
import { getDbWorker } from "./get-db-worker";
import { assetsToRows } from "./set-all-assets";
import {
  toCustomerPointRow,
  toCustomerPointDemandRow,
} from "./set-all-customer-points";
import type {
  AssetRows,
  CustomerPointRow,
  CustomerPointDemandRow,
} from "./rows";

export type CustomerPointDemandUpdate = {
  customerPointId: CustomerPointId;
  demands: CustomerPointDemandRow[];
};

export type ApplyMomentPayload = {
  assetDeleteIds: AssetId[];
  assetUpserts: AssetRows;
  customerPointDeleteIds: CustomerPointId[];
  customerPointUpserts: CustomerPointRow[];
  customerPointDemandUpdates: CustomerPointDemandUpdate[];
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

  const customerPointDeleteIds = [...(moment.deleteCustomerPoints ?? [])];
  const deletedCustomerPointIds = new Set<CustomerPointId>(
    customerPointDeleteIds,
  );

  const customerPointUpserts: CustomerPointRow[] = [];
  for (const cp of moment.putCustomerPoints ?? []) {
    if (deletedCustomerPointIds.has(cp.id)) continue;
    customerPointUpserts.push(toCustomerPointRow(cp));
  }

  const customerPointDemandUpdates: CustomerPointDemandUpdate[] = [];
  for (const assignment of moment.putDemands?.assignments ?? []) {
    if (!("customerPointId" in assignment)) continue;
    if (deletedCustomerPointIds.has(assignment.customerPointId)) continue;
    customerPointDemandUpdates.push({
      customerPointId: assignment.customerPointId,
      demands: assignment.demands.map((demand, ordinal) =>
        toCustomerPointDemandRow(assignment.customerPointId, demand, ordinal),
      ),
    });
  }

  return {
    assetDeleteIds: [...(moment.deleteAssets ?? [])],
    assetUpserts: assetsToRows(upsertAssets),
    customerPointDeleteIds,
    customerPointUpserts,
    customerPointDemandUpdates,
  };
};

export const applyMomentToDb = async (
  moment: ModelMoment,
  postApplyModel: HydraulicModel,
): Promise<void> => {
  const payload = buildMomentPayload(moment, postApplyModel);
  if (
    payload.assetDeleteIds.length === 0 &&
    payload.assetUpserts.junctions.length === 0 &&
    payload.assetUpserts.reservoirs.length === 0 &&
    payload.assetUpserts.tanks.length === 0 &&
    payload.assetUpserts.pipes.length === 0 &&
    payload.assetUpserts.pumps.length === 0 &&
    payload.assetUpserts.valves.length === 0 &&
    payload.customerPointDeleteIds.length === 0 &&
    payload.customerPointUpserts.length === 0 &&
    payload.customerPointDemandUpdates.length === 0
  ) {
    return;
  }

  const worker = getDbWorker();
  await worker.applyMoment(payload);
};
