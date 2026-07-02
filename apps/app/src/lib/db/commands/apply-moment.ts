import type { Moment } from "src/lib/persistence/moment";
import {
  type Asset,
  type AssetId,
  type CustomerPointId,
} from "@epanet-js/hydraulic-model";
import {
  isCustomProperty,
  customAttributeIdFromKey,
} from "@epanet-js/custom-attributes";
import type { AssetPatch } from "src/hydraulic-model/model-operation";
import {
  getWorker,
  timed,
  emptyAssetCustomAttributeUpdates,
  type ApplyMomentPayload,
  type AssetCustomAttributeUpdates,
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
  serializeCustomAttributesDefinition,
} from "@epanet-js/ejsdb-mappers";
import {
  assetPatchesToRows,
  emptyAssetPatchRows,
} from "../mappers/assets/patches";
import type { CustomerPointRow } from "@epanet-js/ejsdb";

const ASSET_TYPE_TO_TABLE: Record<
  AssetPatch["type"],
  keyof AssetCustomAttributeUpdates
> = {
  junction: "junctions",
  reservoir: "reservoirs",
  tank: "tanks",
  pipe: "pipes",
  pump: "pumps",
  valve: "valves",
};

const buildCustomAttributeValues = (
  patches: AssetPatch[] | undefined,
): AssetCustomAttributeUpdates => {
  const updates = emptyAssetCustomAttributeUpdates();
  if (!patches) return updates;

  for (const patch of patches) {
    const properties = patch.properties as Record<string, unknown>;
    const delta: Record<string, string | number | null> = {};
    let hasCustom = false;
    for (const key in properties) {
      if (!isCustomProperty(key)) continue;
      const value = properties[key];
      delta[customAttributeIdFromKey(key)] =
        value === undefined ? null : (value as string | number | null);
      hasCustom = true;
    }
    if (hasCustom) {
      updates[ASSET_TYPE_TO_TABLE[patch.type]].push({
        id: patch.id,
        delta: JSON.stringify(delta),
      });
    }
  }

  return updates;
};

const isEmptyCustomAttributeValues = (
  updates: AssetCustomAttributeUpdates,
): boolean =>
  updates.junctions.length === 0 &&
  updates.reservoirs.length === 0 &&
  updates.tanks.length === 0 &&
  updates.pipes.length === 0 &&
  updates.pumps.length === 0 &&
  updates.valves.length === 0;

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

  const customAttributesDefinition = moment.putCustomAttributesDefinition
    ? serializeCustomAttributesDefinition(moment.putCustomAttributesDefinition)
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
    customAttributesDefinition,
    customAttributeValues: buildCustomAttributeValues(
      moment.patchAssetsAttributes,
    ),
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
      isEmptyCustomAttributeValues(payload.customAttributeValues)
    ) {
      return;
    }

    const worker = getWorker();
    await worker.applyMoment(payload);
  });
};
