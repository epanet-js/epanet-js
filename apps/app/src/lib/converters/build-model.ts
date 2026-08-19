import type {
  JunctionData,
  NetworkData,
  SourceCrs,
} from "@epanet-js/converters";
import {
  HydraulicModel,
  createEmptyDemands,
  initializeHydraulicModel,
} from "src/hydraulic-model";
import {
  AssetFactory,
  HeadlossFormula,
  LabelManager,
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

export type BuildModelOptions = {
  projections: Map<string, Proj4Projection>;
  labelMaxLength?: number;
};

export type BuildModelResult = {
  hydraulicModel: HydraulicModel;
  factories: ModelFactories;
  idGenerator: IdGenerator;
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
  const toElevation = elevationConverter(
    network.units.elevation,
    spec.units.elevation,
  );

  for (const junctionData of network.junctions) {
    addJunction(hydraulicModel, factories.assetFactory, junctionData, {
      labelManager,
      labelMaxLength,
      toWgs84,
      toElevation,
    });
  }

  return {
    hydraulicModel,
    factories,
    idGenerator,
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

const addJunction = (
  hydraulicModel: HydraulicModel,
  assetFactory: AssetFactory,
  junctionData: JunctionData,
  {
    labelManager,
    labelMaxLength,
    toWgs84,
    toElevation,
  }: {
    labelManager: LabelManager;
    labelMaxLength?: number;
    toWgs84: (coordinates: Position) => Position;
    toElevation: (value: number) => number;
  },
) => {
  const junction = assetFactory.createJunction({
    label: resolveLabel(labelManager, junctionData, labelMaxLength),
    coordinates: toWgs84(junctionData.coordinates),
    elevation:
      junctionData.elevation === undefined
        ? undefined
        : toElevation(junctionData.elevation),
  });

  hydraulicModel.assets.set(junction.id, junction);
  hydraulicModel.assetIndex.addNode(junction.id);
  hydraulicModel.demands.junctions.set(junction.id, []);
};

const resolveLabel = (
  labelManager: LabelManager,
  { label, ref }: JunctionData,
  labelMaxLength?: number,
): string | undefined => {
  const candidate = sanitize(label ?? ref, labelMaxLength);
  if (labelManager.isLabelAvailable(candidate, "junction")) return candidate;

  const fallback = sanitize(ref, labelMaxLength);
  if (labelManager.isLabelAvailable(fallback, "junction")) return fallback;

  return undefined;
};

const sanitize = (label: string, labelMaxLength?: number): string =>
  labelMaxLength === undefined
    ? label
    : LabelManager.sanitizeLabel(label, "junction", labelMaxLength);

const elevationConverter = (
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
