import {
  HydraulicModel,
  initializeHydraulicModel,
  Demand,
} from "src/hydraulic-model";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import {
  InpData,
  ItemData,
  JunctionData,
  PipeData,
  PumpData,
  ReservoirData,
  TankData,
  ValveData,
  CustomerPointData,
  PatternData,
  CurveData,
} from "./inp-data";
import { IssuesAccumulator } from "./issues";
import { ModelMetadata } from "src/model-metadata";
import { Quantities, presets } from "src/model-metadata/quantities-spec";
import { Position } from "geojson";
import { PumpStatus } from "src/hydraulic-model/asset-types/pump";
import { ValveStatus } from "src/hydraulic-model/asset-types/valve";
import { ParseInpOptions } from "./parse-inp";
import { Projection } from "src/hydraulic-model/projection";
import { AssetId } from "src/hydraulic-model/asset-types/base-asset";
import { Pump } from "src/hydraulic-model/asset-types/pump";
import {
  ConsecutiveIdsGenerator,
  IdGenerator,
} from "src/hydraulic-model/id-generator";
import {
  CurveId,
  CurvePoint,
  CurveType,
  Curves,
  defaultCurvePoints,
  ICurve,
  isValidPumpCurve,
  getPumpCurveType,
} from "src/hydraulic-model/curves";
import {
  LabelResolver,
  parseSimpleControlsFromText,
  parseRulesFromText,
} from "src/hydraulic-model/controls";
import { LabelManager } from "src/hydraulic-model/label-manager";
import {
  createEmptyDemands,
  Pattern,
  Patterns,
  PatternId,
  PatternMultipliers,
  PatternType,
} from "src/hydraulic-model";
import { PumpBuildData } from "src/hydraulic-model/asset-builder";

type PatternsContext = {
  patterns: Patterns;
  fallbackPatternId?: PatternId;
  idGenerator: IdGenerator;
  labelManager: LabelManager;
};

type CurvesContext = {
  curves: Curves;
  idGenerator: IdGenerator;
  labelManager: LabelManager;
};

export const buildModelWithPatterns = (
  inpData: InpData,
  issues: IssuesAccumulator,
  options?: ParseInpOptions,
  projection: Projection = "wgs84",
): { hydraulicModel: HydraulicModel; modelMetadata: ModelMetadata } => {
  const spec = presets[inpData.options.units];
  const quantities = new Quantities(spec);
  const nodeIds = new ItemData<AssetId>();
  const linkIds = new ItemData<AssetId>();

  const hydraulicModel = initializeHydraulicModel({
    units: quantities.units,
    defaults: quantities.defaults,
    headlossFormula: inpData.options.headlossFormula,
    demands: {
      ...createEmptyDemands(),
      multiplier: inpData.options.demandMultiplier,
    },
    epsTiming: inpData.times,
    projection,
  });

  const curvesContext: CurvesContext = initializeCurvesContext(
    hydraulicModel.labelManager,
    inpData.curves,
  );

  const patternContext: PatternsContext = initializeBuildPatternContext(
    hydraulicModel.labelManager,
    inpData.patterns,
    inpData.options.defaultPattern,
  );

  for (const junctionData of inpData.junctions) {
    addJunction(hydraulicModel, junctionData, {
      inpData,
      issues,
      nodeIds,
      patternContext,
    });
  }

  for (const reservoirData of inpData.reservoirs) {
    addReservoir(hydraulicModel, reservoirData, {
      inpData,
      issues,
      nodeIds,
      patternContext,
    });
  }

  for (const tankData of inpData.tanks) {
    addTank(hydraulicModel, tankData, curvesContext, {
      inpData,
      issues,
      nodeIds,
    });
  }

  for (const pumpData of inpData.pumps) {
    addPump(hydraulicModel, pumpData, curvesContext, {
      inpData,
      issues,
      nodeIds,
      linkIds,
      patternContext,
    });
  }

  for (const valveData of inpData.valves) {
    addValve(hydraulicModel, valveData, curvesContext, {
      inpData,
      issues,
      nodeIds,
      linkIds,
    });
  }

  for (const pipeData of inpData.pipes) {
    addPipe(hydraulicModel, pipeData, {
      inpData,
      issues,
      nodeIds,
      linkIds,
      options,
    });
  }

  const customerPointIdGenerator = new ConsecutiveIdsGenerator();

  for (const customerPointData of inpData.customerPoints) {
    addCustomerPoint(hydraulicModel, customerPointData, {
      inpData,
      nodeIds,
      linkIds,
      patternContext,
      customerPointIdGenerator,
    });
  }

  addCurves(
    hydraulicModel,
    curvesContext.curves,
    inpData.energyEfficiencyCurves,
    linkIds,
    issues,
  );

  addPatterns(
    hydraulicModel,
    patternContext.patterns,
    inpData.sourcePatterns,
    inpData.energyPatterns,
    issues,
  );

  addControls(hydraulicModel, inpData.controls, nodeIds, linkIds);

  return { hydraulicModel, modelMetadata: { quantities } };
};

const initializeCurvesContext = (
  labelManager: LabelManager,
  rawCurves: ItemData<CurveData>,
): CurvesContext => {
  const curveContext: CurvesContext = {
    curves: new Map(),
    labelManager: labelManager,
    idGenerator: new ConsecutiveIdsGenerator(),
  };

  for (const [, curveData] of rawCurves.entries()) {
    addCurve(curveContext, curveData.label, curveData.points);
  }

  return curveContext;
};

const addCurve = (
  curvesContext: CurvesContext,
  label: string,
  points: CurvePoint[],
): ICurve | undefined => {
  const { curves, idGenerator, labelManager } = curvesContext;
  if (points.length === 0) return;

  const id = idGenerator.newId();
  const curve: ICurve = {
    id,
    label,
    points,
    assetIds: new Set(),
  };
  curves.set(curve.id, curve);
  labelManager.register(curve.label, "curve", curve.id);

  return curve;
};

const initializeBuildPatternContext = (
  labelManager: LabelManager,
  rawPatterns: ItemData<PatternData>,
  defaultPatternOption?: string,
): PatternsContext => {
  const patternContext: PatternsContext = {
    patterns: new Map(),
    labelManager: labelManager,
    idGenerator: new ConsecutiveIdsGenerator(),
  };

  for (const [, patternData] of rawPatterns.entries()) {
    addPattern(patternContext, patternData.label, patternData.multipliers);
  }

  patternContext.fallbackPatternId = determineFallbackPatternId(
    patternContext.patterns,
    patternContext.labelManager,
    defaultPatternOption,
  );

  const { patterns } = patternContext;

  const id = labelManager.getIdByLabel(defaultPatternOption || "1", "pattern");
  if (id !== undefined && patterns.has(id)) {
    patternContext.fallbackPatternId = id;
  } else {
    const pattern1Id = labelManager.getIdByLabel("1", "pattern");
    if (pattern1Id !== undefined && patterns.has(pattern1Id)) {
      patternContext.fallbackPatternId = pattern1Id;
    }
  }

  return patternContext;
};

const buildPattern = (
  idGenerator: IdGenerator,
  label: string,
  factors: PatternMultipliers,
): Pattern | undefined => {
  if (factors.length === 0) return undefined;
  if (isConstantPattern(factors)) return undefined;

  const id = idGenerator.newId();
  return {
    id,
    label,
    multipliers: factors,
  };
};

const addPattern = (
  patternsContext: PatternsContext,
  label: string,
  factors: PatternMultipliers,
): Pattern | undefined => {
  const { patterns, idGenerator, labelManager } = patternsContext;
  const pattern = buildPattern(idGenerator, label, factors);
  if (!pattern) return undefined;

  patterns.set(pattern.id, pattern);
  labelManager.register(pattern.label, "pattern", pattern.id);

  return pattern;
};

const determineFallbackPatternId = (
  patterns: Patterns,
  labelManager: LabelManager,
  defaultPatternLabel?: string,
): PatternId | undefined => {
  const id = labelManager.getIdByLabel(defaultPatternLabel || "1", "pattern");
  if (id !== undefined && patterns.has(id)) return id;

  const pattern1Id = labelManager.getIdByLabel("1", "pattern");
  return pattern1Id !== undefined && patterns.has(pattern1Id)
    ? pattern1Id
    : undefined;
};

const buildDemand = (
  patternContext: PatternsContext,
  baseDemand: number,
  patternLabel: string | undefined,
): Demand => {
  const { fallbackPatternId, labelManager, patterns } = patternContext;

  if (patternLabel) {
    const patternId = labelManager.getIdByLabel(patternLabel, "pattern");
    if (patternId !== undefined) {
      markPatternUsed(patterns, patternId, "demand");
      return {
        baseDemand,
        patternId,
      };
    }
  }

  if (fallbackPatternId !== undefined) {
    markPatternUsed(patterns, fallbackPatternId, "demand");
    return {
      baseDemand,
      patternId: fallbackPatternId,
    };
  }

  return { baseDemand };
};
const isConstantPattern = (pattern: PatternMultipliers): boolean => {
  return pattern.every((value) => value === 1);
};

const addJunction = (
  hydraulicModel: HydraulicModel,
  junctionData: JunctionData,
  {
    inpData,
    issues,
    nodeIds,
    patternContext,
  }: {
    inpData: InpData;
    issues: IssuesAccumulator;
    nodeIds: ItemData<AssetId>;
    patternContext: PatternsContext;
  },
) => {
  const coordinates = getNodeCoordinates(inpData, junctionData.id, issues);
  if (!coordinates) return;

  const junctionDemands = inpData.demands.get(junctionData.id) || [];

  const demands: Demand[] =
    junctionDemands.length > 0
      ? junctionDemands
          .filter((d) => d.baseDemand)
          .map((d) => buildDemand(patternContext, d.baseDemand, d.patternLabel))
      : junctionData.baseDemand
        ? [
            buildDemand(
              patternContext,
              junctionData.baseDemand,
              junctionData.patternId,
            ),
          ]
        : [];

  const junction = hydraulicModel.assetBuilder.buildJunction({
    label: junctionData.id,
    coordinates,
    elevation: junctionData.elevation,
    isActive: junctionData.isActive,
  });
  hydraulicModel.assets.set(junction.id, junction);
  hydraulicModel.demands.junctions.set(junction.id, demands);
  nodeIds.set(junctionData.id, junction.id);
};

const addReservoir = (
  hydraulicModel: HydraulicModel,
  reservoirData: ReservoirData,
  {
    inpData,
    issues,
    nodeIds,
    patternContext,
  }: {
    inpData: InpData;
    issues: IssuesAccumulator;
    nodeIds: ItemData<AssetId>;
    patternContext: PatternsContext;
  },
) => {
  const coordinates = getNodeCoordinates(inpData, reservoirData.id, issues);
  if (!coordinates) return;

  let headPatternId: PatternId | undefined;
  if (reservoirData.patternId) {
    const patternId = patternContext.labelManager.getIdByLabel(
      reservoirData.patternId,
      "pattern",
    );
    if (patternId !== undefined) {
      markPatternUsed(patternContext.patterns, patternId, "reservoirHead");
      headPatternId = patternId;
    }
  }

  const reservoir = hydraulicModel.assetBuilder.buildReservoir({
    label: reservoirData.id,
    coordinates,
    head: reservoirData.baseHead,
    elevation: reservoirData.elevation,
    headPatternId,
    isActive: reservoirData.isActive,
  });
  hydraulicModel.assets.set(reservoir.id, reservoir);
  nodeIds.set(reservoirData.id, reservoir.id);
};

const addTank = (
  hydraulicModel: HydraulicModel,
  tankData: TankData,
  curvesContext: CurvesContext,
  {
    inpData,
    issues,
    nodeIds,
  }: {
    inpData: InpData;
    issues: IssuesAccumulator;
    nodeIds: ItemData<AssetId>;
  },
) => {
  const coordinates = getNodeCoordinates(inpData, tankData.id, issues);
  if (!coordinates) return;

  const tank = hydraulicModel.assetBuilder.buildTank({
    label: tankData.id,
    coordinates,
    elevation: tankData.elevation,
    initialLevel: tankData.initialLevel,
    minLevel: tankData.minLevel,
    maxLevel: tankData.maxLevel,
    diameter: tankData.diameter,
    minVolume: tankData.minVolume,
    overflow: tankData.overflow ?? false,
    isActive: tankData.isActive,
  });
  hydraulicModel.assets.set(tank.id, tank);
  nodeIds.set(tankData.id, tank.id);

  if (tankData.volumeCurveId) {
    const curveId = curvesContext.labelManager.getIdByLabel(
      tankData.volumeCurveId,
      "curve",
    );
    if (curveId !== undefined) {
      markCurveUsed(curvesContext.curves, curveId, tank.id, "volume");
    }
  }
};

const addPump = (
  hydraulicModel: HydraulicModel,
  pumpData: PumpData,
  curvesContext: CurvesContext,
  {
    inpData,
    issues,
    nodeIds,
    linkIds,
    patternContext,
  }: {
    inpData: InpData;
    issues: IssuesAccumulator;
    nodeIds: ItemData<AssetId>;
    linkIds: ItemData<AssetId>;
    patternContext: PatternsContext;
  },
) => {
  const linkProperties = getLinkProperties(inpData, issues, nodeIds, pumpData);
  if (!linkProperties) return;

  const { coordinates, connections } = linkProperties;

  let definitionProps: {
    definitionType: PumpBuildData["definitionType"];
    power?: number;
    curve?: CurvePoint[];
    curveId?: number;
  } = {
    definitionType: "power",
    power: 0,
  };

  if (pumpData.power !== undefined) {
    definitionProps = {
      definitionType: "power",
      power: pumpData.power,
    };
  }

  if (pumpData.curveId) {
    const curveId = curvesContext.labelManager.getIdByLabel(
      pumpData.curveId,
      "curve",
    );
    if (curveId === undefined) {
      issues.addUndefinedPumpCurve();
      definitionProps = {
        definitionType: "curve",
        curve: defaultCurvePoints(),
      };
    } else {
      const curve = curvesContext.curves.get(curveId)!;
      if (!isValidPumpCurve(curve.points)) {
        issues.addInvalidPumpCurve();
      }
      definitionProps = {
        definitionType: "curveId",
        curveId: curve.id,
      };
    }
  }

  let initialStatus: PumpStatus = "on";
  let speed = pumpData.speed !== undefined ? pumpData.speed : 1;

  if (inpData.status.has(pumpData.id)) {
    const statusValue = inpData.status.get(pumpData.id) as string;
    if (statusValue === "CLOSED") {
      initialStatus = "off";
    } else if (statusValue === "OPEN") {
      initialStatus = "on";
      speed = 1;
    } else if (!isNaN(parseFloat(statusValue))) {
      speed = parseFloat(statusValue);
    }
  }

  if (pumpData.patternId) {
    const pattern = getPattern(inpData.patterns, pumpData.patternId);
    speed = pattern[0];

    const patternId = patternContext.labelManager.getIdByLabel(
      pumpData.patternId,
      "pattern",
    );
    if (patternId !== undefined) {
      markPatternUsed(patternContext.patterns, patternId, "pumpSpeed");
    }
  }

  const pump = hydraulicModel.assetBuilder.buildPump({
    label: pumpData.id,
    connections,
    ...definitionProps,
    initialStatus,
    speed,
    coordinates,
    isActive: pumpData.isActive,
  });
  hydraulicModel.assets.set(pump.id, pump);
  hydraulicModel.topology.addLink(pump.id, connections[0], connections[1]);
  linkIds.set(pumpData.id, pump.id);
  if (pump.curveId)
    markCurveUsed(curvesContext.curves, pump.curveId, pump.id, "pump");
};

const addValve = (
  hydraulicModel: HydraulicModel,
  valveData: ValveData,
  curvesContext: CurvesContext,
  {
    inpData,
    issues,
    nodeIds,
    linkIds,
  }: {
    inpData: InpData;
    issues: IssuesAccumulator;
    nodeIds: ItemData<AssetId>;
    linkIds: ItemData<AssetId>;
  },
) => {
  const linkProperties = getLinkProperties(inpData, issues, nodeIds, valveData);
  if (!linkProperties) return;
  const { connections, coordinates } = linkProperties;

  let initialStatus: ValveStatus = "active";
  if (inpData.status.has(valveData.id)) {
    const statusValue = inpData.status.get(valveData.id) as string;
    initialStatus = statusValue === "CLOSED" ? "closed" : "open";
  }

  const valve = hydraulicModel.assetBuilder.buildValve({
    label: valveData.id,
    diameter: valveData.diameter,
    minorLoss: valveData.minorLoss,
    kind: valveData.kind,
    setting: valveData.setting,
    initialStatus,
    connections,
    coordinates,
    isActive: valveData.isActive,
  });
  hydraulicModel.assets.set(valve.id, valve);
  hydraulicModel.topology.addLink(valve.id, connections[0], connections[1]);
  linkIds.set(valveData.id, valve.id);

  if (valveData.curveId) {
    const curveId = curvesContext.labelManager.getIdByLabel(
      valveData.curveId,
      "curve",
    );
    if (curveId !== undefined) {
      markCurveUsed(curvesContext.curves, curveId, valve.id, "valve");
    }
  }

  if (valveData.headlossCurveId) {
    const curveId = curvesContext.labelManager.getIdByLabel(
      valveData.headlossCurveId,
      "curve",
    );
    if (curveId !== undefined) {
      markCurveUsed(curvesContext.curves, curveId, valve.id, "headloss");
    }
  }
};

const addPipe = (
  hydraulicModel: HydraulicModel,
  pipeData: PipeData,
  {
    inpData,
    issues,
    nodeIds,
    linkIds,
    options: _options,
  }: {
    inpData: InpData;
    issues: IssuesAccumulator;
    nodeIds: ItemData<AssetId>;
    linkIds: ItemData<AssetId>;
    options?: ParseInpOptions;
  },
) => {
  const linkProperties = getLinkProperties(inpData, issues, nodeIds, pipeData);
  if (!linkProperties) return;
  const { connections, coordinates } = linkProperties;

  let initialStatus = pipeData.initialStatus;

  if (inpData.status.has(pipeData.id)) {
    const statusValue = inpData.status.get(pipeData.id) as string;
    if (statusValue === "CLOSED") {
      initialStatus = "closed";
    } else {
      initialStatus = "open";
    }
  }

  const pipe = hydraulicModel.assetBuilder.buildPipe({
    label: pipeData.id,
    length: pipeData.length,
    diameter: pipeData.diameter,
    minorLoss: pipeData.minorLoss,
    roughness: pipeData.roughness,
    initialStatus,
    connections,
    coordinates,
    isActive: pipeData.isActive,
  });
  hydraulicModel.assets.set(pipe.id, pipe);
  hydraulicModel.topology.addLink(pipe.id, connections[0], connections[1]);
  linkIds.set(pipeData.id, pipe.id);
};

const addCustomerPoint = (
  hydraulicModel: HydraulicModel,
  customerPointData: CustomerPointData,
  {
    inpData,
    nodeIds,
    linkIds,
    patternContext,
    customerPointIdGenerator,
  }: {
    inpData: InpData;
    nodeIds: ItemData<AssetId>;
    linkIds: ItemData<AssetId>;
    patternContext: PatternsContext;
    customerPointIdGenerator: IdGenerator;
  },
) => {
  const id = customerPointIdGenerator.newId();

  const rawDemands = customerPointData.demands ??
    inpData.customerDemands.get(customerPointData.label) ?? [
      { baseDemand: customerPointData.baseDemand },
    ];

  const demands = rawDemands.map((d) =>
    buildDemand(patternContext, d.baseDemand, d.patternLabel),
  );

  const customerPoint = CustomerPoint.build(id, customerPointData.coordinates, {
    label: customerPointData.label,
  });

  if (
    customerPointData.pipeId &&
    customerPointData.snapPoint &&
    customerPointData.junctionId
  ) {
    const junctionId = nodeIds.get(customerPointData.junctionId);
    const pipeId = linkIds.get(customerPointData.pipeId);
    if (junctionId && pipeId) {
      customerPoint.connect({
        pipeId,
        junctionId,
        snapPoint: customerPointData.snapPoint,
      });
    }
    hydraulicModel.customerPointsLookup.addConnection(customerPoint);
  }

  hydraulicModel.customerPoints.set(id, customerPoint);
  hydraulicModel.demands.customerPoints.set(id, demands);
};

const getLinkProperties = (
  inpData: InpData,
  issues: IssuesAccumulator,
  nodeIds: ItemData<AssetId>,
  linkData: { id: string; startNodeDirtyId: string; endNodeDirtyId: string },
) => {
  if (!linkData.startNodeDirtyId || !linkData.endNodeDirtyId) return null;

  const startCoordinates = getNodeCoordinates(
    inpData,
    linkData.startNodeDirtyId,
    issues,
  );
  const endCoordinates = getNodeCoordinates(
    inpData,
    linkData.endNodeDirtyId,
    issues,
  );
  const vertices = getVertices(inpData, linkData.id, issues);

  if (!startCoordinates || !endCoordinates) return null;

  const startNodeId = nodeIds.get(linkData.startNodeDirtyId);
  const endNodeId = nodeIds.get(linkData.endNodeDirtyId);

  if (!startNodeId || !endNodeId) return null;

  return {
    coordinates: [startCoordinates, ...vertices, endCoordinates],
    connections: [startNodeId, endNodeId] as [AssetId, AssetId],
  };
};

const getVertices = (
  inpData: InpData,
  linkId: string,
  issues: IssuesAccumulator,
) => {
  const candidates = inpData.vertices.get(linkId) || [];
  const vertices = candidates.filter((coordinates) => isWgs84(coordinates));
  if (candidates.length !== vertices.length) {
    issues.addInvalidVertices(linkId);
    return [];
  }
  return vertices;
};

const getNodeCoordinates = (
  inpData: InpData,
  nodeId: string,
  issues: IssuesAccumulator,
): Position | null => {
  const nodeCoordinates = inpData.coordinates.get(nodeId);
  if (!nodeCoordinates) {
    issues.addMissingCoordinates(nodeId);
    return null;
  }
  if (!isWgs84(nodeCoordinates)) {
    issues.addInvalidCoordinates(nodeId);
    return null;
  }
  return nodeCoordinates;
};

const isWgs84 = (coordinates: Position) =>
  coordinates[0] >= -180 &&
  coordinates[0] <= 180 &&
  coordinates[1] >= -90 &&
  coordinates[1] <= 90;

const defaultPatternId = "1";

const getPattern = (
  patterns: InpData["patterns"],
  patternId: string | undefined,
): number[] => {
  return patterns.get(patternId || defaultPatternId)?.multipliers || [1];
};

const addControls = (
  hydraulicModel: HydraulicModel,
  rawControls: InpData["controls"],
  nodeIds: ItemData<AssetId>,
  linkIds: ItemData<AssetId>,
): void => {
  const resolveLabel: LabelResolver = (assetType, label) => {
    return assetType === "link" ? linkIds.get(label) : nodeIds.get(label);
  };

  hydraulicModel.controls = {
    simple: parseSimpleControlsFromText(rawControls.simple, resolveLabel),
    rules: parseRulesFromText(rawControls.ruleBased, resolveLabel),
  };
};

const markCurveUsed = (
  curves: Curves,
  curveId: CurveId,
  assetId: AssetId,
  type: CurveType,
) => {
  const curve = curves.get(curveId)!;
  curve.type = type;
  const curveAssetIds = curve.assetIds ?? new Set();
  curveAssetIds.add(assetId);
};

const addCurves = (
  hydraulicModel: HydraulicModel,
  curves: Curves,
  energyEfficiencyCurves: ItemData<string>,
  linkIds: ItemData<AssetId>,
  issues: IssuesAccumulator,
) => {
  for (const [pumpLabel, curveLabel] of energyEfficiencyCurves.entries()) {
    const pumpId = linkIds.get(pumpLabel);
    const curveId = hydraulicModel.labelManager.getIdByLabel(
      curveLabel,
      "curve",
    );
    if (pumpId !== undefined && curveId !== undefined) {
      markCurveUsed(curves, curveId, pumpId, "efficiency");
    }
  }

  const validCurves: Curves = new Map();

  for (const curve of curves.values()) {
    if (curve.type === "pump") {
      const curveType = getPumpCurveType(curve.points);
      if (curveType === "multiPointCurve" || curve.assetIds.size > 1) {
        validCurves.set(curve.id, curve);
        continue;
      }

      const [pumpId] = curve.assetIds;
      const pump = hydraulicModel.assets.get(pumpId) as Pump;
      pump.setProperty("definitionType", "curve");
      pump.feature.properties.curve = curve.points.map((p) => ({ ...p }));
      delete pump.feature.properties.curveId;
      hydraulicModel.labelManager.remove(curve.label, "curve", curve.id);
      continue;
    }

    if (!curve.type) issues.addUnusedCurve();
    hydraulicModel.labelManager.remove(curve.label, "curve", curve.id);
  }
  hydraulicModel.curves = validCurves;
};

const addPatterns = (
  hydraulicModel: HydraulicModel,
  patterns: Patterns,
  sourceStrengthPatterns: Set<string>,
  energyPricePatterns: Set<string>,
  issues: IssuesAccumulator,
) => {
  for (const label of sourceStrengthPatterns) {
    const patternId = hydraulicModel.labelManager.getIdByLabel(
      label,
      "pattern",
    );
    if (patternId !== undefined) {
      markPatternUsed(patterns, patternId, "qualitySourceStrength");
    }
  }

  for (const label of energyPricePatterns) {
    const patternId = hydraulicModel.labelManager.getIdByLabel(
      label,
      "pattern",
    );
    if (patternId !== undefined) {
      markPatternUsed(patterns, patternId, "energyPrice");
    }
  }

  const supportedPatterns: Patterns = new Map();
  for (const pattern of patterns.values()) {
    if (
      pattern.type === "demand" ||
      pattern.type === "reservoirHead" ||
      pattern.type === "pumpSpeed"
    ) {
      supportedPatterns.set(pattern.id, pattern);
    }
    if (!pattern.type) {
      issues.addUnusedPattern();
    }
  }

  hydraulicModel.patterns = supportedPatterns;
};

const markPatternUsed = (
  patterns: Patterns,
  patternId: PatternId,
  type: PatternType,
) => {
  const pattern = patterns.get(patternId);
  if (pattern && !pattern.type) {
    pattern.type = type;
  }
};
