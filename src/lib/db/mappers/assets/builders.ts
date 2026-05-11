import { AssetsMap } from "src/hydraulic-model/assets-map";
import { AssetIndex } from "src/hydraulic-model/asset-index";
import { Topology } from "src/hydraulic-model/topology";
import { ModelFactories } from "src/hydraulic-model/factories";
import type { Position } from "geojson";
import type { Junction } from "src/hydraulic-model/asset-types/junction";
import type { Reservoir } from "src/hydraulic-model/asset-types/reservoir";
import type { Tank } from "src/hydraulic-model/asset-types/tank";
import type { Pipe } from "src/hydraulic-model/asset-types/pipe";
import type { Pump } from "src/hydraulic-model/asset-types/pump";
import type { Valve } from "src/hydraulic-model/asset-types/valve";
import type { ChemicalSourceType } from "src/hydraulic-model/asset-types/node";
import type { PipeStatus } from "src/hydraulic-model/asset-types/pipe";
import type {
  PumpStatus,
  PumpDefintionType,
} from "src/hydraulic-model/asset-types/pump";
import type {
  ValveStatus,
  ValveKind,
} from "src/hydraulic-model/asset-types/valve";
import type { TankMixingModel } from "src/hydraulic-model/asset-types/tank";
import type { CurvePoint } from "src/hydraulic-model/curves";
import type { AssetFactory } from "src/hydraulic-model/factories/asset-factory";
import { pointsSchema } from "../curves/schema";
import { parseRows } from "../parse-rows";
import {
  linkCoordinatesSchema,
  junctionRowSchema,
  reservoirRowSchema,
  tankRowSchema,
  pipeRowSchema,
  pumpRowSchema,
  valveRowSchema,
  type JunctionRow,
  type ReservoirRow,
  type TankRow,
  type PipeRow,
  type PumpRow,
  type ValveRow,
} from "./schema";

export type RawAssetRows = {
  junctions: unknown[];
  reservoirs: unknown[];
  tanks: unknown[];
  pipes: unknown[];
  pumps: unknown[];
  valves: unknown[];
};

export const buildAssetsData = (
  rawRows: RawAssetRows,
  factories: ModelFactories,
): { assets: AssetsMap; assetIndex: AssetIndex; topology: Topology } => {
  const assets: AssetsMap = new Map();
  const topology = new Topology();
  const assetIndex = new AssetIndex(factories.idGenerator, assets);
  const { assetFactory } = factories;

  const junctions = parseRows(
    junctionRowSchema,
    rawRows.junctions,
    "Junctions",
  );
  const reservoirs = parseRows(
    reservoirRowSchema,
    rawRows.reservoirs,
    "Reservoirs",
  );
  const tanks = parseRows(tankRowSchema, rawRows.tanks, "Tanks");
  const pipes = parseRows(pipeRowSchema, rawRows.pipes, "Pipes");
  const pumps = parseRows(pumpRowSchema, rawRows.pumps, "Pumps");
  const valves = parseRows(valveRowSchema, rawRows.valves, "Valves");

  for (const row of junctions) {
    const junction = buildJunction(row, assetFactory);
    assets.set(junction.id, junction);
    assetIndex.addNode(junction.id);
  }

  for (const row of reservoirs) {
    const reservoir = buildReservoir(row, assetFactory);
    assets.set(reservoir.id, reservoir);
    assetIndex.addNode(reservoir.id);
  }

  for (const row of tanks) {
    const tank = buildTank(row, assetFactory);
    assets.set(tank.id, tank);
    assetIndex.addNode(tank.id);
  }

  for (const row of pipes) {
    const pipe = buildPipe(row, assetFactory);
    assets.set(pipe.id, pipe);
    assetIndex.addLink(pipe.id);
    topology.addLink(pipe.id, row.start_node_id, row.end_node_id);
  }

  for (const row of pumps) {
    const pump = buildPump(row, assetFactory);
    assets.set(pump.id, pump);
    assetIndex.addLink(pump.id);
    topology.addLink(pump.id, row.start_node_id, row.end_node_id);
  }

  for (const row of valves) {
    const valve = buildValve(row, assetFactory);
    assets.set(valve.id, valve);
    assetIndex.addLink(valve.id);
    topology.addLink(valve.id, row.start_node_id, row.end_node_id);
  }

  return { assets, assetIndex, topology };
};

const buildJunction = (
  row: JunctionRow,
  assetFactory: AssetFactory,
): Junction =>
  assetFactory.createJunction({
    id: row.id,
    label: row.label ?? undefined,
    coordinates: [row.coord_x, row.coord_y],
    elevation: nullable(row.elevation),
    emitterCoefficient: nullable(row.emitter_coefficient),
    initialQuality: nullable(row.initial_quality),
    chemicalSourceType: nullable(row.chemical_source_type) as
      | ChemicalSourceType
      | undefined,
    chemicalSourceStrength: nullable(row.chemical_source_strength),
    chemicalSourcePatternId: nullable(row.chemical_source_pattern_id),
    isActive: toBool(row.is_active),
  });

const buildReservoir = (
  row: ReservoirRow,
  assetFactory: AssetFactory,
): Reservoir =>
  assetFactory.createReservoir({
    id: row.id,
    label: row.label ?? undefined,
    coordinates: [row.coord_x, row.coord_y],
    elevation: nullable(row.elevation),
    head: nullable(row.head),
    headPatternId: nullable(row.head_pattern_id),
    initialQuality: nullable(row.initial_quality),
    chemicalSourceType: nullable(row.chemical_source_type) as
      | ChemicalSourceType
      | undefined,
    chemicalSourceStrength: nullable(row.chemical_source_strength),
    chemicalSourcePatternId: nullable(row.chemical_source_pattern_id),
    isActive: toBool(row.is_active),
  });

const buildTank = (row: TankRow, assetFactory: AssetFactory): Tank =>
  assetFactory.createTank({
    id: row.id,
    label: row.label ?? undefined,
    coordinates: [row.coord_x, row.coord_y],
    elevation: nullable(row.elevation),
    initialLevel: nullable(row.initial_level),
    minLevel: nullable(row.min_level),
    maxLevel: nullable(row.max_level),
    minVolume: nullable(row.min_volume),
    diameter: nullable(row.diameter),
    overflow: row.overflow === null ? undefined : row.overflow === 1,
    mixingModel: nullable(row.mixing_model) as TankMixingModel | undefined,
    mixingFraction: nullable(row.mixing_fraction),
    initialQuality: nullable(row.initial_quality),
    bulkReactionCoeff: nullable(row.bulk_reaction_coeff),
    chemicalSourceType: nullable(row.chemical_source_type) as
      | ChemicalSourceType
      | undefined,
    chemicalSourceStrength: nullable(row.chemical_source_strength),
    chemicalSourcePatternId: nullable(row.chemical_source_pattern_id),
    isActive: toBool(row.is_active),
    volumeCurveId: nullable(row.volume_curve_id),
  });

const buildPipe = (row: PipeRow, assetFactory: AssetFactory): Pipe =>
  assetFactory.createPipe({
    id: row.id,
    label: row.label ?? undefined,
    coordinates: parseLinkCoordinates(row, "Pipe"),
    connections: [row.start_node_id, row.end_node_id],
    initialStatus: nullable(row.initial_status) as PipeStatus | undefined,
    length: nullable(row.length),
    diameter: nullable(row.diameter),
    roughness: nullable(row.roughness),
    minorLoss: nullable(row.minor_loss),
    bulkReactionCoeff: nullable(row.bulk_reaction_coeff),
    wallReactionCoeff: nullable(row.wall_reaction_coeff),
    isActive: toBool(row.is_active),
  });

const buildPump = (row: PumpRow, assetFactory: AssetFactory): Pump =>
  assetFactory.createPump({
    id: row.id,
    label: row.label ?? undefined,
    coordinates: parseLinkCoordinates(row, "Pump"),
    connections: [row.start_node_id, row.end_node_id],
    initialStatus: nullable(row.initial_status) as PumpStatus | undefined,
    definitionType: row.definition_type as PumpDefintionType,
    power: nullable(row.power),
    curveId: nullable(row.curve_id),
    curve: parsePumpCurvePoints(row),
    speed: nullable(row.speed),
    speedPatternId: nullable(row.speed_pattern_id),
    efficiencyCurveId: nullable(row.efficiency_curve_id),
    energyPrice: nullable(row.energy_price),
    energyPricePatternId: nullable(row.energy_price_pattern_id),
    isActive: toBool(row.is_active),
  });

const buildValve = (row: ValveRow, assetFactory: AssetFactory): Valve =>
  assetFactory.createValve({
    id: row.id,
    label: row.label ?? undefined,
    coordinates: parseLinkCoordinates(row, "Valve"),
    connections: [row.start_node_id, row.end_node_id],
    diameter: nullable(row.diameter),
    minorLoss: nullable(row.minor_loss),
    kind: nullable(row.valve_kind) as ValveKind | undefined,
    setting: nullable(row.setting),
    initialStatus: nullable(row.initial_status) as ValveStatus | undefined,
    isActive: toBool(row.is_active),
    curveId: nullable(row.curve_id),
  });

const nullable = <T>(v: T | null | undefined): T | undefined =>
  v === null ? undefined : v;

const toBool = (v: number): boolean => v === 1;

const parseLinkCoordinates = (
  row: PipeRow | PumpRow | ValveRow,
  kind: string,
): Position[] => {
  let raw: unknown;
  try {
    raw = JSON.parse(row.coords);
  } catch (error) {
    throw new Error(
      `${kind} ${row.id} (${row.label}): coords is not valid JSON`,
      { cause: error },
    );
  }
  const result = linkCoordinatesSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `${kind} ${row.id} (${row.label}): coords must be an array of finite-number arrays — ${result.error.message}`,
    );
  }
  return result.data as Position[];
};

const parsePumpCurvePoints = (row: PumpRow): CurvePoint[] | undefined => {
  if (row.curve_points === null) return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(row.curve_points);
  } catch (error) {
    throw new Error(
      `Pump ${row.id} (${row.label}): inline curve points is not valid JSON`,
      { cause: error },
    );
  }
  const result = pointsSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Pump ${row.id} (${row.label}): inline curve points must be an array of {x,y} with finite numbers — ${result.error.message}`,
    );
  }
  return result.data;
};
