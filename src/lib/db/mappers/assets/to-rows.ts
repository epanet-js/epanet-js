import { Asset } from "src/hydraulic-model/asset-types";
import type { Junction } from "src/hydraulic-model/asset-types/junction";
import type { Reservoir } from "src/hydraulic-model/asset-types/reservoir";
import type { Tank } from "src/hydraulic-model/asset-types/tank";
import type { Pipe } from "src/hydraulic-model/asset-types/pipe";
import type { Pump } from "src/hydraulic-model/asset-types/pump";
import type { Valve } from "src/hydraulic-model/asset-types/valve";
import type { CurvePoint } from "src/hydraulic-model/curves";
import { pointsSchema } from "../curves/schema";
import {
  linkCoordinatesSchema,
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

const toJunctionRow = (junction: Junction): JunctionRow => ({
  id: junction.id,
  type: "junction",
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
});

const toReservoirRow = (reservoir: Reservoir): ReservoirRow => ({
  id: reservoir.id,
  type: "reservoir",
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
});

const toTankRow = (tank: Tank): TankRow => ({
  id: tank.id,
  type: "tank",
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
});

const toPipeRow = (pipe: Pipe): PipeRow => ({
  id: pipe.id,
  type: "pipe",
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
});

const toPumpRow = (pump: Pump): PumpRow => ({
  id: pump.id,
  type: "pump",
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
});

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

const toValveRow = (valve: Valve): ValveRow => ({
  id: valve.id,
  type: "valve",
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
});

const toDbBool = (v: boolean): number => (v ? 1 : 0);

const toDbId = (v: number | undefined): number | null => v ?? null;

const unreachable = (asset: Asset): never => {
  throw new Error(`Unknown asset type: ${asset.type as string}`);
};
