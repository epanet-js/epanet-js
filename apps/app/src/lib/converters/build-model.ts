import type {
  ControlData,
  CustomAttributeValues,
  IssueCode,
  ParserIssue,
  TankLevelControlData,
  TimedSettingControlData,
  CurvePointData,
  DemandData,
  JunctionData,
  LinkData,
  NetworkData,
  NodeData,
  PipeData,
  PumpData,
  ReservoirData,
  SourceCrs,
  TankData,
  ValveData,
  ZoneData,
} from "@epanet-js/converters";
import { IssueCollector } from "@epanet-js/converters";
import {
  HydraulicModel,
  createEmptyDemands,
  initializeHydraulicModel,
} from "src/hydraulic-model";
import {
  Asset,
  AssetFactory,
  AssetId,
  CurveId,
  CurvePoint,
  CurveType,
  Demand,
  LinkAsset,
  PatternId,
  PatternType,
  LinkConnections,
  NodeAsset,
  HeadlossFormula,
  ValveKind,
  computeLinkLength,
  LabelManager,
  LabelType,
  ModelFactories,
  Controls,
  AssetType,
  CustomAttribute,
  CustomAttributeId,
  CustomAttributesDefinition,
  LevelSettingControl,
  SimpleControl,
  Valve,
  buildControlsLookup,
  buildCustomAttributeId,
  createControlId,
  emptyCustomAttributesDefinition,
  initializeModelFactories,
  setAttributes,
} from "@epanet-js/hydraulic-model";
import { ConsecutiveIdsGenerator, IdGenerator } from "@epanet-js/id-generator";
import { inferNodeIsActive } from "src/hydraulic-model/utilities/active-topology";
import {
  importZoneFeatures,
  initializeZones,
  type ZoneFeature,
  type Zones,
} from "src/lib/zones";
import {
  EpanetUnitSystem,
  ProjectSettings,
  getDefaultRoughness,
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
  zones: Zones;
  issues: ParserIssue[];
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
  const customAttributes = planCustomAttributes(network);
  const hydraulicModel = initializeHydraulicModel({
    demands: createEmptyDemands(),
    idGenerator,
    customAttributes: customAttributes.definition,
  });
  const factories = initializeModelFactories({ idGenerator, labelManager });

  const issues = new IssueCollector();
  const projection = resolveProjection(network.crs, projections);
  const { toWgs84 } = createProjectionMapper(projection);

  const nodeIdByRef = new Map<string, BuiltNode>();
  const context: NodeContext = {
    labelManager,
    labelMaxLength,
    customAttributeIds: customAttributes.ids,
    toWgs84,
    toElevation: converterFor(network.units.elevation, spec.units.elevation),
    toLevel: converterFor(network.units.level, spec.units.initialLevel),
    toTankDiameter: converterFor(
      network.units.tankDiameter,
      spec.units.tankDiameter,
    ),
    nodeIdByRef,
    toDemand: converterFor(network.units.flow, spec.units.flow),
    patternIdByRef: addPatterns(hydraulicModel, network, {
      idGenerator,
      labelManager,
      labelMaxLength,
    }),
    curveIdByRef: addCurves(hydraulicModel, network, {
      idGenerator,
      labelManager,
      labelMaxLength,
      toVolume: converterFor(network.units.volume, spec.units.volume),
      toLevel: converterFor(network.units.level, spec.units.initialLevel),
      toFlow: converterFor(network.units.flow, spec.units.flow),
      toHead: converterFor(network.units.elevation, spec.units.head),
    }),
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
    linkIdByRef: new Map<string, AssetId>(),
    lengthUnit: spec.units.length,
    defaultRoughness: getDefaultRoughness(headlossFormula),
    toLength: converterFor(network.units.length, spec.units.length),
    toDiameter: converterFor(network.units.diameter, spec.units.diameter),
    toPressure: converterFor(network.units.pressure, spec.units.pressure),
    toFlow: converterFor(network.units.flow, spec.units.flow),
  };

  for (const pipeData of network.pipes) {
    addPipe(hydraulicModel, factories.assetFactory, pipeData, linkContext);
  }

  for (const pumpData of network.pumps) {
    addPump(hydraulicModel, factories.assetFactory, pumpData, linkContext);
  }

  for (const valveData of network.valves) {
    addValve(hydraulicModel, factories.assetFactory, valveData, linkContext);
  }

  deactivateStrandedNodes(hydraulicModel, network, linkContext);
  addControls(hydraulicModel, network, linkContext, issues);

  return {
    hydraulicModel,
    zones: buildZones(network.zones, toWgs84),
    issues: issues.build(),
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

type CustomAttributeIds = Map<AssetType, Map<string, CustomAttributeId>>;

const customAttributeAssetTypes: AssetType[] = [
  "junction",
  "reservoir",
  "tank",
  "pipe",
  "pump",
  "valve",
];

const planCustomAttributes = (
  network: NetworkData,
): { definition: CustomAttributesDefinition; ids: CustomAttributeIds } => {
  const carriedByType = new Map<AssetType, Set<string>>(
    customAttributeAssetTypes.map((type) => [type, new Set<string>()]),
  );

  const collect = (
    type: AssetType,
    records: { customAttributes?: CustomAttributeValues }[],
  ) => {
    const carried = carriedByType.get(type) as Set<string>;
    for (const record of records) {
      for (const ref of Object.keys(record.customAttributes ?? {})) {
        carried.add(ref);
      }
    }
  };

  collect("junction", network.junctions);
  collect("reservoir", network.reservoirs);
  collect("tank", network.tanks);
  collect("pipe", network.pipes);
  collect("pump", network.pumps);
  collect("valve", network.valves);

  let definition = emptyCustomAttributesDefinition();
  const ids: CustomAttributeIds = new Map();
  let seed = 1;

  for (const type of customAttributeAssetTypes) {
    const carried = carriedByType.get(type) as Set<string>;
    const attributes: CustomAttribute[] = [];
    const idByRef = new Map<string, CustomAttributeId>();

    for (const { ref, name, type: valueType } of network.customAttributes) {
      if (!carried.has(ref)) continue;

      const id = buildCustomAttributeId(seed++);
      idByRef.set(ref, id);
      attributes.push({ id, label: name, type: valueType });
    }

    ids.set(type, idByRef);
    if (attributes.length > 0) {
      definition = setAttributes(definition, type, attributes);
    }
  }

  return { definition, ids };
};

const resolveCustomAttributes = (
  values: CustomAttributeValues | undefined,
  idByRef: Map<string, CustomAttributeId> | undefined,
): Record<string, string | number> | undefined => {
  if (values === undefined || idByRef === undefined) return undefined;

  const resolved: Record<string, string | number> = {};
  for (const [ref, value] of Object.entries(values)) {
    const id = idByRef.get(ref);
    if (id === undefined) continue;

    resolved[id] = value;
  }

  return resolved;
};

const zoneLabelProperty = "label";

const buildZones = (
  zones: ZoneData[],
  toWgs84: (coordinates: Position) => Position,
): Zones => {
  if (zones.length === 0) return initializeZones();

  const features: ZoneFeature[] = zones.map(({ ref, label, polygons }) => ({
    type: "Feature",
    properties: { [zoneLabelProperty]: label ?? ref },
    geometry: {
      type: "MultiPolygon",
      coordinates: polygons.map((polygon) =>
        polygon.map((ring) => ring.map(toWgs84)),
      ),
    },
  }));

  return importZoneFeatures(features, zoneLabelProperty).zones;
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
  customAttributeIds: CustomAttributeIds;
  toWgs84: (coordinates: Position) => Position;
  toElevation: (value: number) => number;
  toLevel: (value: number) => number;
  toTankDiameter: (value: number) => number;
  toDemand: (value: number) => number;
  nodeIdByRef: Map<string, BuiltNode>;
  curveIdByRef: Map<string, CurveId>;
  patternIdByRef: Map<string, PatternId>;
};

type LinkContext = NodeContext & {
  linkIdByRef: Map<string, AssetId>;
  lengthUnit: Unit;
  defaultRoughness: number;
  toLength: (value: number) => number;
  toDiameter: (value: number) => number;
  toPressure: (value: number) => number;
  toFlow: (value: number) => number;
};

type LinkGeometry = {
  coordinates: Position[];
  connections: LinkConnections;
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
  hydraulicModel.demands.junctions.set(
    junction.id,
    demandsOf(junctionData.demands, context),
  );
};

const demandsOf = (
  demands: DemandData[] | undefined,
  { toDemand, patternIdByRef }: NodeContext,
): Demand[] =>
  (demands ?? []).map(({ baseDemand, patternRef }) => {
    const patternId =
      patternRef === undefined ? undefined : patternIdByRef.get(patternRef);

    return {
      baseDemand: toDemand(baseDemand),
      ...(patternId === undefined ? {} : { patternId }),
    };
  });

type PatternContext = {
  idGenerator: IdGenerator;
  labelManager: LabelManager;
  labelMaxLength?: number;
};

const addPatterns = (
  hydraulicModel: HydraulicModel,
  { patterns, reservoirs, pumps }: NetworkData,
  { idGenerator, labelManager, labelMaxLength }: PatternContext,
): Map<string, PatternId> => {
  const typeByRef = patternTypesByRef(reservoirs, pumps);
  const patternIdByRef = new Map<string, PatternId>();

  for (const patternData of patterns) {
    const id = idGenerator.newId();
    const stated = resolveLabel(
      labelManager,
      patternData,
      "pattern",
      labelMaxLength,
    );
    if (stated !== undefined) labelManager.register(stated, "pattern", id);

    hydraulicModel.patterns.set(id, {
      id,
      label: stated ?? labelManager.generateFor("pattern", id),
      type: typeByRef.get(patternData.ref) ?? "demand",
      multipliers: patternData.multipliers,
    });
    patternIdByRef.set(patternData.ref, id);
  }

  return patternIdByRef;
};

const patternTypesByRef = (
  reservoirs: ReservoirData[],
  pumps: PumpData[],
): Map<string, PatternType> => {
  const types = new Map<string, PatternType>();

  for (const { headPatternRef } of reservoirs) {
    if (headPatternRef !== undefined)
      types.set(headPatternRef, "reservoirHead");
  }
  for (const { speedPatternRef } of pumps) {
    if (speedPatternRef !== undefined) types.set(speedPatternRef, "pumpSpeed");
  }

  return types;
};

const addReservoir = (
  hydraulicModel: HydraulicModel,
  assetFactory: AssetFactory,
  reservoirData: ReservoirData,
  context: NodeContext,
) => {
  const { head, headPatternRef } = reservoirData;
  const headPatternId =
    headPatternRef === undefined
      ? undefined
      : context.patternIdByRef.get(headPatternRef);

  const reservoir = assetFactory.createReservoir({
    ...nodeProperties(reservoirData, "reservoir", context),
    head: head === undefined ? undefined : context.toElevation(head),
    headPatternId,
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
    volumeCurveId:
      tankData.volumeCurveRef === undefined
        ? undefined
        : context.curveIdByRef.get(tankData.volumeCurveRef),
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
  const geometry = linkGeometry(pipeData, context);
  if (geometry === null) return;

  const pipe = assetFactory.createPipe({
    ...linkProperties(pipeData, "pipe", geometry, context),
    length: converted(pipeData.length, context.toLength),
    diameter: converted(pipeData.diameter, context.toDiameter),
    roughness: pipeData.roughness,
    minorLoss: pipeData.minorLoss,
    material: pipeData.material,
    initialStatus: pipeData.initialStatus,
  });

  if (pipe.length === null) {
    pipe.setProperty("length", computeLinkLength(pipe, context.lengthUnit));

    if (pipe.roughness === null) {
      pipe.setProperty("roughness", context.defaultRoughness);
    }
  }

  registerLink(
    hydraulicModel,
    pipe,
    pipeData.ref,
    geometry.connections,
    context,
  );
};

const addPump = (
  hydraulicModel: HydraulicModel,
  assetFactory: AssetFactory,
  pumpData: PumpData,
  context: LinkContext,
) => {
  const geometry = linkGeometry(pumpData, context);
  if (geometry === null) return;

  const curveId =
    pumpData.curveRef === undefined
      ? undefined
      : context.curveIdByRef.get(pumpData.curveRef);

  const pump = assetFactory.createPump({
    ...linkProperties(pumpData, "pump", geometry, context),
    speed: pumpData.speed,
    speedPatternId:
      pumpData.speedPatternRef === undefined
        ? undefined
        : context.patternIdByRef.get(pumpData.speedPatternRef),
    initialStatus: pumpData.initialStatus,
    ...(curveId === undefined
      ? {}
      : { definitionType: "curveId" as const, curveId }),
  });

  registerLink(
    hydraulicModel,
    pump,
    pumpData.ref,
    geometry.connections,
    context,
  );
};

type CurveContext = {
  idGenerator: IdGenerator;
  labelManager: LabelManager;
  labelMaxLength?: number;
  toVolume: (value: number) => number;
  toLevel: (value: number) => number;
  toFlow: (value: number) => number;
  toHead: (value: number) => number;
};

const addCurves = (
  hydraulicModel: HydraulicModel,
  { curves, pumps, tanks }: NetworkData,
  context: CurveContext,
): Map<string, CurveId> => {
  const { idGenerator, labelManager, labelMaxLength } = context;
  const typeByRef = curveTypesByRef(pumps, tanks);
  const curveIdByRef = new Map<string, CurveId>();

  for (const curveData of curves) {
    const id = idGenerator.newId();
    const stated = resolveLabel(
      labelManager,
      curveData,
      "curve",
      labelMaxLength,
    );
    if (stated !== undefined) labelManager.register(stated, "curve", id);

    const type = typeByRef.get(curveData.ref);

    hydraulicModel.curves.set(id, {
      id,
      label: stated ?? labelManager.generateFor("curve", id),
      ...(type === undefined ? {} : { type }),
      points: curvePoints(curveData.points, type, context),
    });
    curveIdByRef.set(curveData.ref, id);
  }

  return curveIdByRef;
};

const curvePoints = (
  points: CurvePointData[],
  type: CurveType | undefined,
  { toVolume, toLevel, toFlow, toHead }: CurveContext,
): CurvePoint[] => {
  const [toX, toY] = type === "volume" ? [toLevel, toVolume] : [toFlow, toHead];

  return points.map(({ x, y }) => ({ x: toX(x), y: toY(y) }));
};

const curveTypesByRef = (
  pumps: PumpData[],
  tanks: TankData[],
): Map<string, CurveType> => {
  const types = new Map<string, CurveType>();

  for (const { curveRef } of pumps) {
    if (curveRef !== undefined) types.set(curveRef, "pump");
  }
  for (const { volumeCurveRef } of tanks) {
    if (volumeCurveRef !== undefined) types.set(volumeCurveRef, "volume");
  }

  return types;
};

const addValve = (
  hydraulicModel: HydraulicModel,
  assetFactory: AssetFactory,
  valveData: ValveData,
  context: LinkContext,
) => {
  const geometry = linkGeometry(valveData, context);
  if (geometry === null) return;

  const kind = valveKindOf(valveData);
  const valve = assetFactory.createValve({
    ...linkProperties(valveData, "valve", geometry, context),
    kind,
    setting: converted(valveData.setting, settingConverterFor(kind, context)),
    diameter: converted(valveData.diameter, context.toDiameter),
    initialStatus: valveData.initialStatus,
  });

  registerLink(
    hydraulicModel,
    valve,
    valveData.ref,
    geometry.connections,
    context,
  );
};

const unknownValveFallback = "tcv" as const satisfies ValveKind;

const valveKindOf = ({ kind }: ValveData): ValveKind =>
  kind === "unknown" ? unknownValveFallback : kind;

const settingConverterFor = (
  kind: ValveKind,
  { toPressure, toFlow }: LinkContext,
): ((value: number) => number) => {
  if (kind === "prv" || kind === "psv" || kind === "pbv") return toPressure;
  if (kind === "fcv") return toFlow;

  return (value) => value;
};

const linkGeometry = (
  linkData: LinkData,
  { nodeIdByRef, toWgs84 }: LinkContext,
): LinkGeometry | null => {
  const start = nodeIdByRef.get(linkData.startNodeRef);
  const end = nodeIdByRef.get(linkData.endNodeRef);
  if (start === undefined || end === undefined) return null;

  const vertices = (linkData.vertices ?? []).map(toWgs84);

  return {
    coordinates: [start.coordinates, ...vertices, end.coordinates],
    connections: [start.id, end.id],
  };
};

const linkProperties = (
  linkData: LinkData,
  type: AssetType,
  { coordinates, connections }: LinkGeometry,
  { labelManager, labelMaxLength, customAttributeIds }: LinkContext,
) => ({
  label: resolveLabel(labelManager, linkData, type, labelMaxLength),
  coordinates,
  connections,
  isActive: linkData.isActive,
  customAttributes: resolveCustomAttributes(
    linkData.customAttributes,
    customAttributeIds.get(type),
  ),
});

const registerLink = (
  hydraulicModel: HydraulicModel,
  link: LinkAsset,
  ref: string,
  connections: LinkConnections,
  { linkIdByRef }: LinkContext,
) => {
  hydraulicModel.assets.set(link.id, link);
  hydraulicModel.assetIndex.addLink(link.id);
  hydraulicModel.topology.addLink(link.id, connections[0], connections[1]);
  linkIdByRef.set(ref, link.id);
};

const deactivateStrandedNodes = (
  hydraulicModel: HydraulicModel,
  network: NetworkData,
  { nodeIdByRef }: LinkContext,
): void => {
  const { topology, assets } = hydraulicModel;
  const candidates = new Set<AssetId>();

  for (const link of [...network.pipes, ...network.pumps, ...network.valves]) {
    if (link.isActive !== false) continue;

    for (const ref of [link.startNodeRef, link.endNodeRef]) {
      const built = nodeIdByRef.get(ref);
      if (built !== undefined) candidates.add(built.id);
    }
  }

  const noDeletions = new Set<AssetId>();
  const noNewAssets: Asset[] = [];

  for (const nodeId of candidates) {
    const node = assets.get(nodeId) as NodeAsset;
    if (inferNodeIsActive(node, noDeletions, noNewAssets, topology, assets))
      continue;

    node.setProperty("isActive", false);
  }
};

const addControls = (
  hydraulicModel: HydraulicModel,
  { controls }: NetworkData,
  context: LinkContext,
  issues: IssueCollector,
): void => {
  const built: Controls = [];

  for (const controlData of controls) {
    const raw = rawControlsFor(controlData, hydraulicModel, context, issues);
    if (raw !== undefined) {
      hydraulicModel.rawControls.simple.push(...raw);
      continue;
    }

    if (controlData.type !== "tankLevel") continue;

    const control = tankLevelControlOf(controlData, context);
    if (control === undefined) continue;

    built.push(control);
  }

  hydraulicModel.controls = built;
  hydraulicModel.controlsLookup = buildControlsLookup(built);
};

// A float modulates as the tank fills; EPANET can only shut a link or open it,
// and a two-state stand-in reads as support for something we do not model. A
// setpoint held at another node, or one following the flow, has no form at all.
const unsupported: Record<string, IssueCode> = {
  tankFloat: "tankFloatControlUnsupported",
  remotePressure: "remotePressureControlUnsupported",
  flowModulatedSetpoint: "flowModulatedSetpointUnsupported",
};

const rawControlsFor = (
  controlData: ControlData,
  hydraulicModel: HydraulicModel,
  context: LinkContext,
  issues: IssueCollector,
): SimpleControl[] | undefined => {
  const code = unsupported[controlData.type];
  if (code !== undefined) {
    issues.add({
      code,
      severity: "warning",
      ref: controlData.link.ref,
    });
    return [];
  }

  const linkId = context.linkIdByRef.get(controlData.link.ref);
  if (linkId === undefined) return [];

  switch (controlData.type) {
    case "timedSetting":
      return scheduleRows(controlData, linkId, hydraulicModel, context);
    case "tankLevel":
      return controlData.link.kind === "pump"
        ? undefined
        : levelRows(controlData, linkId, hydraulicModel, context);
    default:
      return [];
  }
};

const linkRow = (
  linkId: AssetId,
  action: string,
  condition?: { nodeId: AssetId; direction: "ABOVE" | "BELOW"; level: number },
): SimpleControl =>
  condition === undefined
    ? {
        template: `LINK {{0}} ${action}`,
        assetReferences: [{ assetId: linkId, isActionTarget: true }],
      }
    : {
        template: `LINK {{0}} ${action} IF NODE {{1}} ${condition.direction} ${condition.level}`,
        assetReferences: [
          { assetId: linkId, isActionTarget: true },
          { assetId: condition.nodeId, isActionTarget: false },
        ],
      };

const scheduleRows = (
  { steps }: TimedSettingControlData,
  linkId: AssetId,
  hydraulicModel: HydraulicModel,
  context: LinkContext,
): SimpleControl[] => {
  const convert = settingConverter(linkId, hydraulicModel, context);
  if (convert === undefined) return [];

  return steps.map((step) =>
    linkRow(
      linkId,
      `${
        "setting" in step
          ? String(convert(step.setting))
          : step.status.toUpperCase()
      } AT TIME ${asClockTime(step.time)}`,
    ),
  );
};

const levelRows = (
  { tankRef, on, off }: TankLevelControlData,
  linkId: AssetId,
  hydraulicModel: HydraulicModel,
  context: LinkContext,
): SimpleControl[] => {
  const tank = context.nodeIdByRef.get(tankRef);
  if (tank === undefined) return [];

  const onAction =
    "status" in on ? openAction(linkId, hydraulicModel) : String(on.setting);

  return [
    linkRow(linkId, onAction, {
      nodeId: tank.id,
      direction: "BELOW",
      level: context.toLevel(on.level),
    }),
    linkRow(linkId, "CLOSED", {
      nodeId: tank.id,
      direction: "ABOVE",
      level: context.toLevel(off.level),
    }),
  ];
};

// A valve reopens to the position the source gave it, not to no loss at all —
// EPANET reads a bare OPEN on a throttle as "ignore the setting".
const openAction = (
  linkId: AssetId,
  hydraulicModel: HydraulicModel,
): string => {
  const link = hydraulicModel.assets.get(linkId);
  if (link === undefined || link.type !== "valve") return "OPEN";

  const { setting } = link as Valve;
  return setting == null ? "OPEN" : String(setting);
};

const settingConverter = (
  linkId: AssetId,
  hydraulicModel: HydraulicModel,
  context: LinkContext,
): ((value: number) => number) | undefined => {
  const link = hydraulicModel.assets.get(linkId);
  if (link === undefined) return undefined;
  if (link.type !== "valve") return (value) => value;

  return settingConverterFor((link as Valve).kind, context);
};

const asClockTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${hours}:${String(minutes).padStart(2, "0")}`;
};

const tankLevelControlOf = (
  { link, tankRef, on, off }: TankLevelControlData,
  { linkIdByRef, nodeIdByRef, toLevel }: LinkContext,
): LevelSettingControl | undefined => {
  const linkId = linkIdByRef.get(link.ref);
  const tank = nodeIdByRef.get(tankRef);
  if (linkId === undefined || tank === undefined) return undefined;

  return {
    id: createControlId(),
    type: "level-setting",
    linkId,
    tankId: tank.id,
    on: { level: toLevel(on.level), setting: "status" in on ? 1 : on.setting },
    off: { level: toLevel(off.level) },
  };
};

const nodeProperties = (
  nodeData: NodeData,
  type: AssetType,
  {
    labelManager,
    labelMaxLength,
    toWgs84,
    toElevation,
    customAttributeIds,
  }: NodeContext,
) => ({
  label: resolveLabel(labelManager, nodeData, type, labelMaxLength),
  coordinates: toWgs84(nodeData.coordinates),
  elevation:
    nodeData.elevation === undefined
      ? undefined
      : toElevation(nodeData.elevation),
  customAttributes: resolveCustomAttributes(
    nodeData.customAttributes,
    customAttributeIds.get(type),
  ),
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
