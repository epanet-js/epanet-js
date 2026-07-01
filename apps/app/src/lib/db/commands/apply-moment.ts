import type { Moment } from "src/lib/persistence/moment";
import {
  type Asset,
  type AssetId,
  type CustomerPointId,
} from "@epanet-js/hydraulic-model";
import type { CustomAttributesData } from "@epanet-js/custom-attributes";
import {
  getWorker,
  timed,
  type ApplyMomentPayload,
  type CustomAttributesDataSave,
  type CustomerPointDemandUpdate,
  type JunctionDemandUpdate,
} from "@epanet-js/ejsdb";
import {
  assetsToRows,
  toCustomerPointRow,
  toCustomerPointDemandRow,
  toJunctionDemandRow,
  patternsToRows,
  curvesToRows,
  serializeRawControls,
  serializeControls,
  serializeCustomAttributesData,
  serializeCustomAttributesDefinition,
} from "@epanet-js/ejsdb-mappers";
import {
  assetPatchesToRows,
  emptyAssetPatchRows,
} from "../mappers/assets/patches";
import type { CustomerPointRow } from "@epanet-js/ejsdb";

const buildCustomAttributesDataSave = (
  moment: Moment,
): CustomAttributesDataSave | null => {
  if (!moment.customAttributes) return null;

  const changes = moment.customAttributes.putValues;
  if (changes.length === 0) return null;

  const affected = new Set<number>();
  const resolved: CustomAttributesData = new Map();
  for (const { assetId, values } of changes) {
    affected.add(assetId);
    if (values.size > 0) resolved.set(assetId, values);
  }

  const upserts = serializeCustomAttributesData(resolved, affected);
  const presentIds = new Set(upserts.map((row) => row.asset_id));
  const deleteIds = [...affected].filter((id) => !presentIds.has(id));
  return { upserts, deleteIds };
};

export const buildMomentPayload = (moment: Moment): ApplyMomentPayload => {
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

  const rawControlsReplacement = moment.putRawControls
    ? serializeRawControls(moment.putRawControls)
    : null;

  const controlsReplacement = moment.putControls
    ? serializeControls(moment.putControls)
    : null;

  const customAttributesData = moment.customAttributes
    ? buildCustomAttributesDataSave(moment)
    : null;

  const customAttributesDefinition = moment.customAttributes?.putDefinition
    ? serializeCustomAttributesDefinition(moment.customAttributes.putDefinition)
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
    rawControlsReplacement,
    controlsReplacement,
    customAttributesData,
    customAttributesDefinition,
  };
};

export const applyMomentToDb = async (
  payload: ApplyMomentPayload,
): Promise<void> => {
  await timed("applyMomentToDb", async () => {
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
      payload.rawControlsReplacement === null &&
      payload.controlsReplacement === null &&
      payload.customAttributesDefinition === null &&
      (payload.customAttributesData === null ||
        (payload.customAttributesData.upserts.length === 0 &&
          payload.customAttributesData.deleteIds.length === 0))
    ) {
      return;
    }

    const worker = getWorker();
    await worker.applyMoment(payload);
  });
};
