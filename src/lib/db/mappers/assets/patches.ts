import type { AssetPatch } from "src/hydraulic-model/model-operation";
import type { AssetId } from "src/hydraulic-model/asset-types/base-asset";
import type { CurvePoint } from "src/hydraulic-model/curves";
import { pointsSchema } from "../curves/schema";

export type AssetPatchRow = { id: AssetId } & Record<string, unknown>;

export type AssetPatchRows = {
  junctions: AssetPatchRow[];
  reservoirs: AssetPatchRow[];
  tanks: AssetPatchRow[];
  pipes: AssetPatchRow[];
  pumps: AssetPatchRow[];
  valves: AssetPatchRow[];
};

export const emptyAssetPatchRows = (): AssetPatchRows => ({
  junctions: [],
  reservoirs: [],
  tanks: [],
  pipes: [],
  pumps: [],
  valves: [],
});

export const assetPatchesToRows = (
  patches: readonly AssetPatch[],
): AssetPatchRows => {
  const rows = emptyAssetPatchRows();
  for (const patch of patches) {
    switch (patch.type) {
      case "junction":
        rows.junctions.push(
          toPatchRow(patch.id, patch.properties, junctionMap),
        );
        break;
      case "reservoir":
        rows.reservoirs.push(
          toPatchRow(patch.id, patch.properties, reservoirMap),
        );
        break;
      case "tank":
        rows.tanks.push(toPatchRow(patch.id, patch.properties, tankMap));
        break;
      case "pipe":
        rows.pipes.push(toPatchRow(patch.id, patch.properties, pipeMap));
        break;
      case "pump":
        rows.pumps.push(toPatchRow(patch.id, patch.properties, pumpMap));
        break;
      case "valve":
        rows.valves.push(toPatchRow(patch.id, patch.properties, valveMap));
        break;
    }
  }
  return rows;
};

type ColumnMap = Record<
  string,
  { col: string; transform?: (v: unknown) => unknown }
>;

const toPatchRow = (
  id: AssetId,
  properties: Record<string, unknown>,
  map: ColumnMap,
): AssetPatchRow => {
  const row: AssetPatchRow = { id };
  for (const key in properties) {
    const entry = map[key];
    if (!entry) continue;
    const value = properties[key];
    row[entry.col] = entry.transform ? entry.transform(value) : value;
  }
  return row;
};

const toDbBool = (v: unknown): number => (v ? 1 : 0);
const toNullable = (v: unknown): unknown => (v === undefined ? null : v);

const toPumpCurvePoints = (v: unknown): string | null => {
  if (v === undefined || v === null) return null;
  const result = pointsSchema.safeParse(v as CurvePoint[]);
  if (!result.success) {
    throw new Error(
      `Pump patch: inline curve points must be an array of {x,y} with finite numbers — ${result.error.message}`,
    );
  }
  return JSON.stringify(result.data);
};

const sharedAssetMap: ColumnMap = {
  label: { col: "label" },
  isActive: { col: "is_active", transform: toDbBool },
};

const sharedNodeMap: ColumnMap = {
  ...sharedAssetMap,
  elevation: { col: "elevation" },
  initialQuality: { col: "initial_quality", transform: toNullable },
  chemicalSourceType: {
    col: "chemical_source_type",
    transform: toNullable,
  },
  chemicalSourceStrength: {
    col: "chemical_source_strength",
    transform: toNullable,
  },
  chemicalSourcePatternId: {
    col: "chemical_source_pattern_id",
    transform: toNullable,
  },
};

const sharedLinkMap: ColumnMap = {
  ...sharedAssetMap,
  length: { col: "length", transform: toNullable },
  initialStatus: { col: "initial_status", transform: toNullable },
};

const junctionMap: ColumnMap = {
  ...sharedNodeMap,
  emitterCoefficient: { col: "emitter_coefficient" },
};

const reservoirMap: ColumnMap = {
  ...sharedNodeMap,
  head: { col: "head", transform: toNullable },
  headPatternId: { col: "head_pattern_id", transform: toNullable },
};

const tankMap: ColumnMap = {
  ...sharedNodeMap,
  initialLevel: { col: "initial_level", transform: toNullable },
  minLevel: { col: "min_level", transform: toNullable },
  maxLevel: { col: "max_level", transform: toNullable },
  minVolume: { col: "min_volume", transform: toNullable },
  diameter: { col: "diameter", transform: toNullable },
  overflow: { col: "overflow", transform: toDbBool },
  mixingModel: { col: "mixing_model", transform: toNullable },
  mixingFraction: { col: "mixing_fraction", transform: toNullable },
  bulkReactionCoeff: { col: "bulk_reaction_coeff", transform: toNullable },
  volumeCurveId: { col: "volume_curve_id", transform: toNullable },
};

const pipeMap: ColumnMap = {
  ...sharedLinkMap,
  diameter: { col: "diameter", transform: toNullable },
  roughness: { col: "roughness", transform: toNullable },
  minorLoss: { col: "minor_loss", transform: toNullable },
  bulkReactionCoeff: { col: "bulk_reaction_coeff", transform: toNullable },
  wallReactionCoeff: { col: "wall_reaction_coeff", transform: toNullable },
};

const pumpMap: ColumnMap = {
  ...sharedLinkMap,
  definitionType: { col: "definition_type" },
  power: { col: "power", transform: toNullable },
  speed: { col: "speed", transform: toNullable },
  speedPatternId: { col: "speed_pattern_id", transform: toNullable },
  efficiencyCurveId: { col: "efficiency_curve_id", transform: toNullable },
  energyPrice: { col: "energy_price", transform: toNullable },
  energyPricePatternId: {
    col: "energy_price_pattern_id",
    transform: toNullable,
  },
  curveId: { col: "curve_id", transform: toNullable },
  curve: { col: "curve_points", transform: toPumpCurvePoints },
};

const valveMap: ColumnMap = {
  ...sharedLinkMap,
  diameter: { col: "diameter", transform: toNullable },
  minorLoss: { col: "minor_loss", transform: toNullable },
  kind: { col: "valve_kind", transform: toNullable },
  setting: { col: "setting", transform: toNullable },
  curveId: { col: "curve_id", transform: toNullable },
};
