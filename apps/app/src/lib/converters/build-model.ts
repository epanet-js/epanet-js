import type {
  JunctionData,
  NetworkData,
  NodeData,
  ReservoirData,
  SourceCrs,
  TankData,
} from "@epanet-js/converters";
import {
  HydraulicModel,
  createEmptyDemands,
  initializeHydraulicModel,
} from "src/hydraulic-model";
import {
  AssetFactory,
  DefaultsSpec,
  HeadlossFormula,
  LabelManager,
  LabelType,
  ModelFactories,
  initializeModelFactories,
} from "@epanet-js/hydraulic-model";
import { ConsecutiveIdsGenerator, IdGenerator } from "@epanet-js/id-generator";
import {
  EpanetUnitSystem,
  ProjectSettings,
  presets,
  withHeadlossDefaults,
  withPressureUnit,
} from "@epanet-js/project-settings";
import { convertTo, type FlowUnit, type Unit } from "@epanet-js/quantity";
import {
  WGS84,
  createProjectionMapper,
  findProjectionByCode,
  type Proj4Projection,
  type Projection,
} from "@epanet-js/projections";
import type { Position } from "geojson";
import type { BBox } from "@turf/helpers";
import type { Maybe } from "purify-ts/Maybe";
import { getExtent } from "@epanet-js/geometry";

export type BuildModelOptions = {
  projections: Map<string, Proj4Projection>;
  labelMaxLength?: number;
};

export type BuildModelResult = {
  hydraulicModel: HydraulicModel;
  factories: ModelFactories;
  idGenerator: IdGenerator;
  bounds: Maybe<BBox>;
  projectSettings: Pick<
    ProjectSettings,
    "units" | "defaults" | "headlossFormula" | "formatting" | "projection"
  >;
};

export const buildModel = (
  network: NetworkData,
  { projections, labelMaxLength }: BuildModelOptions,
): BuildModelResult => {
  const headlossFormula: HeadlossFormula = "H-W";
  const baseSpec = presets[chooseUnitSystem(network.units.flow)];
  const spec = network.units.pressure
    ? withPressureUnit(baseSpec, network.units.pressure)
    : baseSpec;
  const defaults = withHeadlossDefaults(spec.defaults, headlossFormula);

  const idGenerator = new ConsecutiveIdsGenerator();
  const labelManager = new LabelManager();
  const hydraulicModel = initializeHydraulicModel({
    demands: createEmptyDemands(),
    idGenerator,
  });
  const factories = initializeModelFactories({ idGenerator, labelManager });

  const projection = resolveProjection(network.crs, projections);
  const { toWgs84 } = createProjectionMapper(projection);

  const context: NodeContext = {
    labelManager,
    labelMaxLength,
    toWgs84,
    toElevation: converterFor(network.units.elevation, spec.units.elevation),
    toLevel: converterFor(network.units.level, spec.units.initialLevel),
    toTankDiameter: converterFor(
      network.units.diameter,
      spec.units.tankDiameter,
    ),
    defaults,
  };

  for (const junctionData of network.junctions) {
    addJunction(hydraulicModel, factories.assetFactory, junctionData, context);
  }

  for (const reservoirData of network.reservoirs) {
    addReservoir(
      hydraulicModel,
      factories.assetFactory,
      reservoirData,
      context,
    );
  }

  for (const tankData of network.tanks) {
    addTank(hydraulicModel, factories.assetFactory, tankData, context);
  }

  return {
    hydraulicModel,
    factories,
    idGenerator,
    bounds: getExtent(
      [...hydraulicModel.assets.values()].map((a) => a.feature),
    ),
    projectSettings: {
      units: spec.units,
      defaults,
      headlossFormula,
      formatting: { decimals: spec.decimals, defaultDecimals: 3 },
      projection,
    },
  };
};

const resolveProjection = (
  crs: SourceCrs,
  projections: Map<string, Proj4Projection>,
): Projection => {
  if (crs.type !== "epsg") return WGS84;

  return findProjectionByCode(String(crs.code), projections) ?? WGS84;
};

type NodeContext = {
  labelManager: LabelManager;
  labelMaxLength?: number;
  toWgs84: (coordinates: Position) => Position;
  toElevation: (value: number) => number;
  toLevel: (value: number) => number;
  toTankDiameter: (value: number) => number;
  defaults: DefaultsSpec;
};

const addJunction = (
  hydraulicModel: HydraulicModel,
  assetFactory: AssetFactory,
  junctionData: JunctionData,
  context: NodeContext,
) => {
  const junction = assetFactory.createJunction({
    ...nodeProperties(junctionData, "junction", context),
  });

  hydraulicModel.assets.set(junction.id, junction);
  hydraulicModel.assetIndex.addNode(junction.id);
  hydraulicModel.demands.junctions.set(junction.id, []);
};

const addReservoir = (
  hydraulicModel: HydraulicModel,
  assetFactory: AssetFactory,
  reservoirData: ReservoirData,
  context: NodeContext,
) => {
  const { head } = reservoirData;
  const reservoir = assetFactory.createReservoir({
    ...nodeProperties(reservoirData, "reservoir", context),
    ...(head === undefined
      ? { relativeHead: context.defaults.reservoir.relativeHead }
      : { head: context.toElevation(head) }),
  });

  hydraulicModel.assets.set(reservoir.id, reservoir);
  hydraulicModel.assetIndex.addNode(reservoir.id);
};

const addTank = (
  hydraulicModel: HydraulicModel,
  assetFactory: AssetFactory,
  tankData: TankData,
  context: NodeContext,
) => {
  const { defaults, toLevel, toTankDiameter } = context;
  const tankDefaults = defaults.tank;

  const minLevel = convertOr(tankData.minLevel, toLevel, tankDefaults.minLevel);
  const initialLevel = convertOr(
    tankData.initialLevel,
    toLevel,
    tankDefaults.initialLevel,
  );
  const maxLevel = convertOr(tankData.maxLevel, toLevel, tankDefaults.maxLevel);

  const tank = assetFactory.createTank({
    ...nodeProperties(tankData, "tank", context),
    minLevel,
    initialLevel,
    maxLevel: coherentMaxLevel(maxLevel, initialLevel),
    diameter: convertOr(
      usable(tankData.diameter),
      toTankDiameter,
      tankDefaults.diameter,
    ),
    minVolume: convertOr(tankData.minVolume, toLevel, tankDefaults.minVolume),
  });

  hydraulicModel.assets.set(tank.id, tank);
  hydraulicModel.assetIndex.addNode(tank.id);
};

const nodeProperties = (
  nodeData: NodeData,
  type: LabelType,
  { labelManager, labelMaxLength, toWgs84, toElevation }: NodeContext,
) => ({
  label: resolveLabel(labelManager, nodeData, type, labelMaxLength),
  coordinates: toWgs84(nodeData.coordinates),
  elevation:
    nodeData.elevation === undefined
      ? undefined
      : toElevation(nodeData.elevation),
});

const coherentMaxLevel = (
  maxLevel: number | undefined,
  initialLevel: number | undefined,
): number | undefined => {
  if (maxLevel === undefined || initialLevel === undefined) return maxLevel;

  return Math.max(maxLevel, initialLevel);
};

const usable = (value: number | undefined): number | undefined =>
  value === 0 ? undefined : value;

const convertOr = (
  value: number | undefined,
  convert: (value: number) => number,
  fallback: number | undefined,
): number | undefined => (value === undefined ? fallback : convert(value));

const resolveLabel = (
  labelManager: LabelManager,
  { label, ref }: NodeData,
  type: LabelType,
  labelMaxLength?: number,
): string | undefined => {
  const candidate = sanitize(label ?? ref, type, labelMaxLength);
  if (labelManager.isLabelAvailable(candidate, type)) return candidate;

  const fallback = sanitize(ref, type, labelMaxLength);
  if (labelManager.isLabelAvailable(fallback, type)) return fallback;

  return undefined;
};

const sanitize = (
  label: string,
  type: LabelType,
  labelMaxLength?: number,
): string =>
  labelMaxLength === undefined
    ? label
    : LabelManager.sanitizeLabel(label, type, labelMaxLength);

const converterFor = (
  sourceUnit: Unit | undefined,
  targetUnit: Unit,
): ((value: number) => number) => {
  if (
    sourceUnit === undefined ||
    targetUnit === null ||
    sourceUnit === targetUnit
  )
    return (value) => value;

  return (value) => convertTo({ value, unit: sourceUnit }, targetUnit);
};

const unitSystemByFlowUnit: Record<FlowUnit, EpanetUnitSystem | null> = {
  "l/s": "LPS",
  "l/min": "LPM",
  "Ml/d": "MLD",
  "m^3/h": "CMH",
  "m^3/d": "CMD",
  "gal/min": "GPM",
  "ft^3/s": "CFS",
  "Mgal/d": "MGD",
  "IMgal/d": "IMGD",
  "acft/d": "AFD",
  "l/h": null,
  "l/d": null,
  "gal/d": null,
  "ft^3/d": null,
};

const chooseUnitSystem = (flowUnit?: FlowUnit): EpanetUnitSystem =>
  (flowUnit && unitSystemByFlowUnit[flowUnit]) ?? "LPS";
