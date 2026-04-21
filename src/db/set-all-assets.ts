import { AssetsMap } from "src/hydraulic-model/assets-map";
import { Asset } from "src/hydraulic-model/asset-types";
import type { Junction } from "src/hydraulic-model/asset-types/junction";
import type { Reservoir } from "src/hydraulic-model/asset-types/reservoir";
import type { Tank } from "src/hydraulic-model/asset-types/tank";
import type { Pipe } from "src/hydraulic-model/asset-types/pipe";
import type { Pump } from "src/hydraulic-model/asset-types/pump";
import type { Valve } from "src/hydraulic-model/asset-types/valve";
import { getDbWorker } from "./get-db-worker";
import type {
  AssetRows,
  JunctionRow,
  ReservoirRow,
  TankRow,
  PipeRow,
  PumpRow,
  ValveRow,
} from "./rows";

export const setAllAssets = async (assets: AssetsMap): Promise<void> => {
  const payload = assetsToRows(assets.values());
  const worker = getDbWorker();
  await worker.setAllAssets(payload);
};

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
  coords: JSON.stringify(pipe.coordinates),
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
  coords: JSON.stringify(pump.coordinates),
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
});

const toValveRow = (valve: Valve): ValveRow => ({
  id: valve.id,
  type: "valve",
  label: valve.label,
  is_active: toDbBool(valve.isActive),
  start_node_id: valve.connections[0],
  end_node_id: valve.connections[1],
  coords: JSON.stringify(valve.coordinates),
  length: valve.length,
  initial_status: valve.initialStatus,
  diameter: valve.diameter,
  minor_loss: valve.minorLoss,
  valve_kind: valve.kind,
  setting: valve.setting,
  curve_id: toDbId(valve.curveId),
});

const toDbBool = (v: boolean): number => (v ? 1 : 0);

const toDbId = (v: number | undefined): string | null =>
  v === undefined ? null : String(v);

const unreachable = (asset: Asset): never => {
  throw new Error(`Unknown asset type: ${asset.type as string}`);
};
