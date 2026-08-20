import type {
  JunctionData,
  NetworkData,
  NodeData,
  PipeData,
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
  AssetId,
  NodeAsset,
  HeadlossFormula,
  computeLinkLength,
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
  const headlossFormula: HeadlossFormula = network.headlossFormula ?? "H-W";
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

  const nodeIdByRef = new Map<string, BuiltNode>();
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
    nodeIdByRef,
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

  const linkContext: LinkContext = {
    ...context,
    lengthUnit: spec.units.length,
    toLength: converterFor(network.units.length, spec.units.length),
    toDiameter: converterFor(network.units.diameter, spec.units.diameter),
  };

  for (const pipeData of network.pipes) {
    addPipe(hydraulicModel, factories.assetFactory, pipeData, linkContext);
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

type BuiltNode = { id: AssetId; coordinates: Position };

type NodeContext = {
  labelManager: LabelManager;
  labelMaxLength?: number;
  toWgs84: (coordinates: Position) => Position;
  toElevation: (value: number) => number;
  toLevel: (value: number) => number;
  toTankDiameter: (value: number) => number;
  nodeIdByRef: Map<string, BuiltNode>;
};

type LinkContext = NodeContext & {
  lengthUnit: Unit;
  toLength: (value: number) => number;
  toDiameter: (value: number) => number;
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

  registerNode(hydraulicModel, junction, junctionData.ref, context);
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
    head: head === undefined ? undefined : context.toElevation(head),
  });

  registerNode(hydraulicModel, reservoir, reservoirData.ref, context);
};

const addTank = (
  hydraulicModel: HydraulicModel,
  assetFactory: AssetFactory,
  tankData: TankData,
  context: NodeContext,
) => {
  const { toLevel, toTankDiameter } = context;

  const tank = assetFactory.createTank({
    ...nodeProperties(tankData, "tank", context),
    minLevel: converted(tankData.minLevel, toLevel),
    initialLevel: converted(tankData.initialLevel, toLevel),
    maxLevel: converted(tankData.maxLevel, toLevel),
    diameter: converted(tankData.diameter, toTankDiameter),
    minVolume: tankData.minVolume,
  });

  registerNode(hydraulicModel, tank, tankData.ref, context);
};

const registerNode = (
  hydraulicModel: HydraulicModel,
  node: NodeAsset,
  ref: string,
  { nodeIdByRef }: NodeContext,
) => {
  hydraulicModel.assets.set(node.id, node);
  hydraulicModel.assetIndex.addNode(node.id);
  nodeIdByRef.set(ref, { id: node.id, coordinates: node.coordinates });
};

const addPipe = (
  hydraulicModel: HydraulicModel,
  assetFactory: AssetFactory,
  pipeData: PipeData,
  context: LinkContext,
) => {
  const { nodeIdByRef, toWgs84, toLength, toDiameter, lengthUnit } = context;

  const start = nodeIdByRef.get(pipeData.startNodeRef);
  const end = nodeIdByRef.get(pipeData.endNodeRef);
  if (start === undefined || end === undefined) return;

  const vertices = (pipeData.vertices ?? []).map(toWgs84);
  const pipe = assetFactory.createPipe({
    label: resolveLabel(
      context.labelManager,
      pipeData,
      "pipe",
      context.labelMaxLength,
    ),
    coordinates: [start.coordinates, ...vertices, end.coordinates],
    connections: [start.id, end.id],
    length: converted(pipeData.length, toLength),
    diameter: converted(pipeData.diameter, toDiameter),
    roughness: pipeData.roughness,
    isActive: pipeData.isActive,
  });

  if (pipe.length === null) {
    pipe.setProperty("length", computeLinkLength(pipe, lengthUnit));
  }

  hydraulicModel.assets.set(pipe.id, pipe);
  hydraulicModel.assetIndex.addLink(pipe.id);
  hydraulicModel.topology.addLink(pipe.id, start.id, end.id);
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

const converted = (
  value: number | undefined,
  convert: (value: number) => number,
): number | undefined => (value === undefined ? undefined : convert(value));

const resolveLabel = (
  labelManager: LabelManager,
  { label, ref }: { label?: string; ref: string },
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
