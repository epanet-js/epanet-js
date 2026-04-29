import { Asset } from "src/hydraulic-model/asset-types";
import type { Junction } from "src/hydraulic-model/asset-types/junction";
import type { Reservoir } from "src/hydraulic-model/asset-types/reservoir";
import type { Tank } from "src/hydraulic-model/asset-types/tank";
import type { Pipe } from "src/hydraulic-model/asset-types/pipe";
import type { Pump } from "src/hydraulic-model/asset-types/pump";
import type { Valve } from "src/hydraulic-model/asset-types/valve";
import type { CurvePoint } from "src/hydraulic-model/curves";
import type { ZodTypeAny } from "zod";
import { pointsSchema } from "../curves/schema";
import {
  linkCoordinatesSchema,
  junctionRowSchema,
  reservoirRowSchema,
  tankRowSchema,
  pipeRowSchema,
  pumpRowSchema,
  valveRowSchema,
  type AssetRows,
  type JunctionRow,
  type ReservoirRow,
  type TankRow,
  type PipeRow,
  type PumpRow,
  type ValveRow,
} from "./schema";

export const assetsToRows = (assets: Iterable<Asset>): AssetRows => {
  const rows: AssetRows = {
    junctions: [],
    reservoirs: [],
    tanks: [],
    pipes: [],
    pumps: [],
    valves: [],
  };
  for (const asset of assets) {
    switch (asset.type) {
      case "junction":
        rows.junctions.push(toJunctionRow(asset as Junction));
        break;
      case "reservoir":
        rows.reservoirs.push(toReservoirRow(asset as Reservoir));
        break;
      case "tank":
        rows.tanks.push(toTankRow(asset as Tank));
        break;
      case "pipe":
        rows.pipes.push(toPipeRow(asset as Pipe));
        break;
      case "pump":
        rows.pumps.push(toPumpRow(asset as Pump));
        break;
      case "valve":
        rows.valves.push(toValveRow(asset as Valve));
        break;
      default:
        unreachable(asset);
    }
  }
  return rows;
};

const validateRow = <T>(
  schema: ZodTypeAny,
  row: unknown,
  kind: string,
  id: number,
  label: string | null,
): T => {
  const result = schema.safeParse(row);
  if (!result.success) {
    throw new Error(
      `${kind} ${id} (${label ?? ""}): row does not match schema — ${result.error.message}`,
    );
  }
  return result.data as T;
};

const toJunctionRow = (junction: Junction): JunctionRow =>
  validateRow<JunctionRow>(
    junctionRowSchema,
    {
      id: junction.id,
      label: junction.label,
      is_active: toDbBool(junction.isActive),
      coord_x: junction.coordinates[0],
      coord_y: junction.coordinates[1],
      elevation: junction.elevation,
      initial_quality: junction.initialQuality,
      chemical_source_type: junction.chemicalSourceType ?? null,
      chemical_source_strength: junction.chemicalSourceStrength ?? null,
      chemical_source_pattern_id: toDbId(junction.chemicalSourcePatternId),
      emitter_coefficient: junction.emitterCoefficient,
    },
    "Junction",
    junction.id,
    junction.label,
  );

const toReservoirRow = (reservoir: Reservoir): ReservoirRow =>
  validateRow<ReservoirRow>(
    reservoirRowSchema,
    {
      id: reservoir.id,
      label: reservoir.label,
      is_active: toDbBool(reservoir.isActive),
      coord_x: reservoir.coordinates[0],
      coord_y: reservoir.coordinates[1],
      elevation: reservoir.elevation,
      initial_quality: reservoir.initialQuality,
      chemical_source_type: reservoir.chemicalSourceType ?? null,
      chemical_source_strength: reservoir.chemicalSourceStrength ?? null,
      chemical_source_pattern_id: toDbId(reservoir.chemicalSourcePatternId),
      head: reservoir.head,
      head_pattern_id: toDbId(reservoir.headPatternId),
    },
    "Reservoir",
    reservoir.id,
    reservoir.label,
  );

const toTankRow = (tank: Tank): TankRow =>
  validateRow<TankRow>(
    tankRowSchema,
    {
      id: tank.id,
      label: tank.label,
      is_active: toDbBool(tank.isActive),
      coord_x: tank.coordinates[0],
      coord_y: tank.coordinates[1],
      elevation: tank.elevation,
      initial_quality: tank.initialQuality,
      chemical_source_type: tank.chemicalSourceType ?? null,
      chemical_source_strength: tank.chemicalSourceStrength ?? null,
      chemical_source_pattern_id: toDbId(tank.chemicalSourcePatternId),
      initial_level: tank.initialLevel,
      min_level: tank.minLevel,
      max_level: tank.maxLevel,
      min_volume: tank.minVolume,
      diameter: tank.diameter,
      overflow: toDbBool(tank.overflow),
      mixing_model: tank.mixingModel,
      mixing_fraction: tank.mixingFraction,
      bulk_reaction_coeff: tank.bulkReactionCoeff ?? null,
      volume_curve_id: toDbId(tank.volumeCurveId),
    },
    "Tank",
    tank.id,
    tank.label,
  );

const toPipeRow = (pipe: Pipe): PipeRow =>
  validateRow<PipeRow>(
    pipeRowSchema,
    {
      id: pipe.id,
      label: pipe.label,
      is_active: toDbBool(pipe.isActive),
      start_node_id: pipe.connections[0],
      end_node_id: pipe.connections[1],
      coords: toDbLinkCoordinates(pipe, "Pipe"),
      length: pipe.length,
      initial_status: pipe.initialStatus,
      diameter: pipe.diameter,
      roughness: pipe.roughness,
      minor_loss: pipe.minorLoss,
      bulk_reaction_coeff: pipe.bulkReactionCoeff ?? null,
      wall_reaction_coeff: pipe.wallReactionCoeff ?? null,
    },
    "Pipe",
    pipe.id,
    pipe.label,
  );

const toPumpRow = (pump: Pump): PumpRow =>
  validateRow<PumpRow>(
    pumpRowSchema,
    {
      id: pump.id,
      label: pump.label,
      is_active: toDbBool(pump.isActive),
      start_node_id: pump.connections[0],
      end_node_id: pump.connections[1],
      coords: toDbLinkCoordinates(pump, "Pump"),
      length: pump.length,
      initial_status: pump.initialStatus,
      definition_type: pump.definitionType,
      power: pump.power,
      speed: pump.speed,
      speed_pattern_id: toDbId(pump.speedPatternId),
      efficiency_curve_id: toDbId(pump.efficiencyCurveId),
      energy_price: pump.energyPrice ?? null,
      energy_price_pattern_id: toDbId(pump.energyPricePatternId),
      curve_id: toDbId(pump.curveId),
      curve_points: toDbCurvePoints(pump),
    },
    "Pump",
    pump.id,
    pump.label,
  );

const toValveRow = (valve: Valve): ValveRow =>
  validateRow<ValveRow>(
    valveRowSchema,
    {
      id: valve.id,
      label: valve.label,
      is_active: toDbBool(valve.isActive),
      start_node_id: valve.connections[0],
      end_node_id: valve.connections[1],
      coords: toDbLinkCoordinates(valve, "Valve"),
      length: valve.length,
      initial_status: valve.initialStatus,
      diameter: valve.diameter,
      minor_loss: valve.minorLoss,
      valve_kind: valve.kind,
      setting: valve.setting,
      curve_id: toDbId(valve.curveId),
    },
    "Valve",
    valve.id,
    valve.label,
  );

const toDbLinkCoordinates = (
  link: Pipe | Pump | Valve,
  kind: string,
): string => {
  const result = linkCoordinatesSchema.safeParse(link.coordinates);
  if (!result.success) {
    throw new Error(
      `${kind} ${link.id} (${link.label}): coords must be an array of finite-number arrays — ${result.error.message}`,
    );
  }
  return JSON.stringify(result.data);
};

const toDbCurvePoints = (pump: Pump): string | null => {
  const points: CurvePoint[] | undefined = pump.curve;
  if (!points) return null;
  const result = pointsSchema.safeParse(points);
  if (!result.success) {
    throw new Error(
      `Pump ${pump.id} (${pump.label}): inline curve points must be an array of {x,y} with finite numbers — ${result.error.message}`,
    );
  }
  return JSON.stringify(result.data);
};

const toDbBool = (v: boolean): number => (v ? 1 : 0);

const toDbId = (v: number | undefined): number | null => v ?? null;

const unreachable = (asset: Asset): never => {
  throw new Error(`Unknown asset type: ${asset.type as string}`);
};
