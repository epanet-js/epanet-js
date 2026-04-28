import type { ModelMoment } from "src/hydraulic-model/model-operation";
import type { Asset } from "src/hydraulic-model/asset-types";
import type { AssetId } from "src/hydraulic-model/asset-types/base-asset";
import type { CustomerPointId } from "src/hydraulic-model/customer-points";
import { getDbWorker } from "./get-db-worker";
import { timed } from "./perf-log";
import { assetsToRows } from "./mappers/assets/to-rows";
import {
  toCustomerPointRow,
  toCustomerPointDemandRow,
} from "./mappers/customer-points/to-rows";
import { toJunctionDemandRow } from "./mappers/junction-demands/to-rows";
import { patternsToRows } from "./mappers/patterns/to-rows";
import { curvesToRows } from "./mappers/curves/to-rows";
import { serializeControls } from "./mappers/controls/to-rows";
import {
  assetPatchesToRows,
  emptyAssetPatchRows,
  type AssetPatchRows,
} from "./mappers/assets/patches";
import type { AssetRows } from "./mappers/assets/schema";
import type {
  CustomerPointRow,
  CustomerPointDemandRow,
} from "./mappers/customer-points/schema";
import type { JunctionDemandRow } from "./mappers/junction-demands/schema";
import type { PatternRow } from "./mappers/patterns/schema";
import type { CurveRow } from "./mappers/curves/schema";

export type CustomerPointDemandUpdate = {
  customerPointId: CustomerPointId;
  demands: CustomerPointDemandRow[];
};

export type JunctionDemandUpdate = {
  junctionId: AssetId;
  demands: JunctionDemandRow[];
};

export type ApplyMomentPayload = {
  assetDeleteIds: AssetId[];
  assetUpserts: AssetRows;
  assetPatches: AssetPatchRows;
  customerPointDeleteIds: CustomerPointId[];
  customerPointUpserts: CustomerPointRow[];
  customerPointDemandUpdates: CustomerPointDemandUpdate[];
  junctionDemandUpdates: JunctionDemandUpdate[];
  patternsReplacement: PatternRow[] | null;
  curvesReplacement: CurveRow[] | null;
  controlsReplacement: string | null;
};

export const buildMomentPayload = (moment: ModelMoment): ApplyMomentPayload => {
  const upsertAssets: Asset[] = [];
  if (moment.putAssets) {
    const byId = new Map<AssetId, Asset>();
    for (const asset of moment.putAssets) byId.set(asset.id, asset);
    upsertAssets.push(...byId.values());
  }

  const assetPatches = moment.patchAssetsAttributes
    ? assetPatchesToRows(moment.patchAssetsAttributes)
    : emptyAssetPatchRows();

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
  const junctionDemandUpdates: JunctionDemandUpdate[] = [];
  for (const assignment of moment.putDemands?.assignments ?? []) {
    if ("customerPointId" in assignment) {
      if (deletedCustomerPointIds.has(assignment.customerPointId)) continue;
      customerPointDemandUpdates.push({
        customerPointId: assignment.customerPointId,
        demands: assignment.demands.map((demand, ordinal) =>
          toCustomerPointDemandRow(assignment.customerPointId, demand, ordinal),
        ),
      });
    } else {
      junctionDemandUpdates.push({
        junctionId: assignment.junctionId,
        demands: assignment.demands.map((demand, ordinal) =>
          toJunctionDemandRow(assignment.junctionId, demand, ordinal),
        ),
      });
    }
  }

  const patternsReplacement = moment.putPatterns
    ? patternsToRows(moment.putPatterns)
    : null;

  const curvesReplacement = moment.putCurves
    ? curvesToRows(moment.putCurves)
    : null;

  const controlsReplacement = moment.putControls
    ? serializeControls(moment.putControls)
    : null;

  return {
    assetDeleteIds: [...(moment.deleteAssets ?? [])],
    assetUpserts: assetsToRows(upsertAssets),
    assetPatches,
    customerPointDeleteIds,
    customerPointUpserts,
    customerPointDemandUpdates,
    junctionDemandUpdates,
    patternsReplacement,
    curvesReplacement,
    controlsReplacement,
  };
};

export const applyMomentToDb = async (moment: ModelMoment): Promise<void> => {
  await timed("applyMomentToDb", async () => {
    const payload = await timed("applyMomentToDb.buildPayload", () =>
      buildMomentPayload(moment),
    );
    if (
      payload.assetDeleteIds.length === 0 &&
      payload.assetUpserts.junctions.length === 0 &&
      payload.assetUpserts.reservoirs.length === 0 &&
      payload.assetUpserts.tanks.length === 0 &&
      payload.assetUpserts.pipes.length === 0 &&
      payload.assetUpserts.pumps.length === 0 &&
      payload.assetUpserts.valves.length === 0 &&
      payload.assetPatches.junctions.length === 0 &&
      payload.assetPatches.reservoirs.length === 0 &&
      payload.assetPatches.tanks.length === 0 &&
      payload.assetPatches.pipes.length === 0 &&
      payload.assetPatches.pumps.length === 0 &&
      payload.assetPatches.valves.length === 0 &&
      payload.customerPointDeleteIds.length === 0 &&
      payload.customerPointUpserts.length === 0 &&
      payload.customerPointDemandUpdates.length === 0 &&
      payload.junctionDemandUpdates.length === 0 &&
      payload.patternsReplacement === null &&
      payload.curvesReplacement === null &&
      payload.controlsReplacement === null
    ) {
      return;
    }

    const worker = getDbWorker();
    await worker.applyMoment(payload);
  });
};
