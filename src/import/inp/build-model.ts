import {
  HydraulicModel,
  initializeHydraulicModel,
  Demand,
} from "src/hydraulic-model";
import {
  CustomerPointFactory,
  ModelFactories,
  initializeModelFactories,
} from "src/hydraulic-model/factories";
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
import type { TankMixingModel } from "src/hydraulic-model/asset-types/tank";
import { ProjectSettings } from "src/lib/project-settings";
import {
  presets,
  withPressureUnit,
  withHeadlossDefaults,
} from "src/lib/project-settings/quantities-spec";
import type { Unit } from "src/quantity";
import { Position } from "geojson";
import { PumpStatus } from "src/hydraulic-model/asset-types/pump";
import { ValveStatus } from "src/hydraulic-model/asset-types/valve";
import { ParseInpOptions } from "./parse-inp";
import { AssetId } from "src/hydraulic-model/asset-types/base-asset";
import { Pump } from "src/hydraulic-model/asset-types/pump";
import { ConsecutiveIdsGenerator, IdGenerator } from "src/lib/id-generator";
import {
  CurveId,
  CurvePoint,
  CurveType,
  Curves,
  defaultCurvePoints,
  ICurve,
  isValidCurve,
  getCurvePointsType,
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
import {
  AssetFactory,
  PumpBuildData,
} from "src/hydraulic-model/factories/asset-factory";

type PatternsContext = {
  patterns: Patterns;
  fallbackPatternId?: PatternId;
  idGenerator: IdGenerator;
  labelManager: LabelManager;
  duplicates: Map<PatternId, Map<PatternType, PatternId>>;
};

type CurvesContext = {
  curves: Curves;
  pumpCurves: Map<CurveId, AssetId[]>;
  idGenerator: IdGenerator;
  labelManager: LabelManager;
  duplicates: Map<CurveId, Map<CurveType, CurveId>>;
};

export const buildModel = (
  inpData: InpData,
  issues: IssuesAccumulator,
  options?: ParseInpOptions & { skipWgs84Validation?: boolean },
): {
  hydraulicModel: HydraulicModel;
  factories: ModelFactories;
  idGenerator: IdGenerator;
  projectSettings: Pick<
    ProjectSettings,
    "units" | "defaults" | "headlossFormula" | "formatting"
  >;
} => {
  const baseSpec = presets[inpData.options.units];
  const spec = inpData.options.pressureUnit
    ? withPressureUnit(baseSpec, inpData.options.pressureUnit as Unit)
    : baseSpec;
  const defaults = withHeadlossDefaults(
    spec.defaults,
    inpData.options.headlossFormula,
  );
  const skipWgs84Validation = options?.skipWgs84Validation ?? false;
  const nodeIds = new ItemData<AssetId>();
  const linkIds = new ItemData<AssetId>();

  const idGenerator = new ConsecutiveIdsGenerator();
  const labelManager = new LabelManager();
  const hydraulicModel = initializeHydraulicModel({
    demands: createEmptyDemands(),
    idGenerator,
  });

  const factories = initializeModelFactories({
    idGenerator,
    labelManager,
    defaults,
  });

  const { assetFactory } = factories;

  const curvesContext: CurvesContext = initializeCurvesContext(
    labelManager,
    inpData.curves,
  );

  const patternContext: PatternsContext = initializeBuildPatternContext(
    labelManager,
    inpData.patterns,
    inpData.options.defaultPattern,
  );

  const qualityType = inpData.options.qualitySimulationType;
  const isSupportedQualityType =
    qualityType === "NONE" || (options?.waterAge && qualityType === "AGE");

  if (!isSupportedQualityType && qualityType) {
    issues.addWaterQualityType(qualityType);
  }

  for (const junctionData of inpData.junctions) {
    addJunction(assetFactory, hydraulicModel, junctionData, {
      inpData,
      issues,
      nodeIds,
      patternContext,
      skipWgs84Validation,
    });
  }

  for (const reservoirData of inpData.reservoirs) {
    addReservoir(assetFactory, hydraulicModel, reservoirData, {
      inpData,
      issues,
      nodeIds,
      patternContext,
      skipWgs84Validation,
    });
  }

  for (const tankData of inpData.tanks) {
    addTank(assetFactory, hydraulicModel, tankData, curvesContext, {
      inpData,
      issues,
      nodeIds,
      skipWgs84Validation,
    });
  }

  for (const pumpData of inpData.pumps) {
    addPump(
      assetFactory,
      hydraulicModel,
      pumpData,
      curvesContext,
      patternContext,
      {
        inpData,
        issues,
        nodeIds,
        linkIds,
        skipWgs84Validation,
      },
    );
  }

  for (const valveData of inpData.valves) {
    addValve(assetFactory, hydraulicModel, valveData, curvesContext, {
      inpData,
      issues,
      nodeIds,
      linkIds,
      skipWgs84Validation,
    });
  }

  for (const pipeData of inpData.pipes) {
    addPipe(assetFactory, hydraulicModel, pipeData, {
      inpData,
      issues,
      nodeIds,
      linkIds,
      options,
      skipWgs84Validation,
    });
  }

  for (const customerPointData of inpData.customerPoints) {
    addCustomerPoint(hydraulicModel, customerPointData, patternContext, {
      inpData,
      nodeIds,
      linkIds,
      customerPointFactory: factories.customerPointFactory,
    });
  }

  addCurves(
    hydraulicModel,
    labelManager,
    curvesContext,
    issues,
    inpData.curves,
  );

  addPatterns(
    hydraulicModel,
    labelManager,
    patternContext,
    inpData.sourcePatterns,
    inpData.energy.globalPattern,
    inpData.patterns,
  );

  addControls(hydraulicModel, inpData.controls, nodeIds, linkIds);

  return {
    hydraulicModel,
    factories,
    idGenerator,
    projectSettings: {
      units: spec.units,
      defaults,
      headlossFormula: inpData.options.headlossFormula,
      formatting: { decimals: spec.decimals, defaultDecimals: 3 },
    },
  };
};

const initializeCurvesContext = (
  labelManager: LabelManager,
  rawCurves: ItemData<CurveData>,
): CurvesContext => {
  const curveContext: CurvesContext = {
    curves: new Map(),
    pumpCurves: new Map(),
    labelManager: labelManager,
    idGenerator: new ConsecutiveIdsGenerator(),
    duplicates: new Map(),
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
    duplicates: new Map(),
  };

  for (const [, patternData] of rawPatterns.entries()) {
    addPattern(patternContext, patternData.label, patternData.multipliers);
  }

  patternContext.fallbackPatternId = determineFallbackPatternId(
    patternContext.patterns,
    patternContext.labelManager,
    defaultPatternOption,
  );

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
  const { fallbackPatternId, labelManager } = patternContext;

  if (patternLabel) {
    const patternId = labelManager.getIdByLabel(patternLabel, "pattern");
    if (patternId !== undefined) {
      const effectiveId = markPatternUsed(patternContext, patternId, "demand");
      return {
        baseDemand,
        patternId: effectiveId,
      };
    }
  }

  if (fallbackPatternId !== undefined) {
    const effectiveId = markPatternUsed(
      patternContext,
      fallbackPatternId,
      "demand",
    );
    return {
      baseDemand,
      patternId: effectiveId,
    };
  }

  return { baseDemand };
};
const isConstantPattern = (pattern: PatternMultipliers): boolean => {
  return pattern.every((value) => value === 1);
};

const addJunction = (
  assetFactory: AssetFactory,
  hydraulicModel: HydraulicModel,
  junctionData: JunctionData,
  {
    inpData,
    issues,
    nodeIds,
    patternContext,
    skipWgs84Validation,
  }: {
    inpData: InpData;
    issues: IssuesAccumulator;
    nodeIds: ItemData<AssetId>;
    patternContext: PatternsContext;
    skipWgs84Validation: boolean;
  },
) => {
  const coordinates = getNodeCoordinates(
    inpData,
    junctionData.id,
    issues,
    skipWgs84Validation,
  );
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

  const emitterCoefficient = inpData.emitters.get(junctionData.id);

  const initialWaterAge =
    inpData.options.qualitySimulationType === "AGE"
      ? inpData.quality.get(junctionData.id)
      : undefined;

  const junction = assetFactory.createJunction({
    label: junctionData.id,
    coordinates,
    elevation: junctionData.elevation,
    emitterCoefficient,
    initialWaterAge,
    isActive: junctionData.isActive,
  });
  hydraulicModel.assets.set(junction.id, junction);
  hydraulicModel.demands.junctions.set(junction.id, demands);
  nodeIds.set(junctionData.id, junction.id);
};

const addReservoir = (
  assetFactory: AssetFactory,
  hydraulicModel: HydraulicModel,
  reservoirData: ReservoirData,
  {
    inpData,
    issues,
    nodeIds,
    patternContext,
    skipWgs84Validation,
  }: {
    inpData: InpData;
    issues: IssuesAccumulator;
    nodeIds: ItemData<AssetId>;
    patternContext: PatternsContext;
    skipWgs84Validation: boolean;
  },
) => {
  const coordinates = getNodeCoordinates(
    inpData,
    reservoirData.id,
    issues,
    skipWgs84Validation,
  );
  if (!coordinates) return;

  let headPatternId: PatternId | undefined;
  if (reservoirData.patternId) {
    const patternId = patternContext.labelManager.getIdByLabel(
      reservoirData.patternId,
      "pattern",
    );
    if (patternId !== undefined) {
      headPatternId = markPatternUsed(
        patternContext,
        patternId,
        "reservoirHead",
      );
    }
  }

  const initialWaterAge =
    inpData.options.qualitySimulationType === "AGE"
      ? inpData.quality.get(reservoirData.id)
      : undefined;

  const reservoir = assetFactory.createReservoir({
    label: reservoirData.id,
    coordinates,
    head: reservoirData.baseHead,
    elevation: reservoirData.elevation,
    headPatternId,
    initialWaterAge,
    isActive: reservoirData.isActive,
  });
  hydraulicModel.assets.set(reservoir.id, reservoir);
  nodeIds.set(reservoirData.id, reservoir.id);
};

const addTank = (
  assetFactory: AssetFactory,
  hydraulicModel: HydraulicModel,
  tankData: TankData,
  curvesContext: CurvesContext,
  {
    inpData,
    issues,
    nodeIds,
    skipWgs84Validation,
  }: {
    inpData: InpData;
    issues: IssuesAccumulator;
    nodeIds: ItemData<AssetId>;
    skipWgs84Validation: boolean;
  },
) => {
  const coordinates = getNodeCoordinates(
    inpData,
    tankData.id,
    issues,
    skipWgs84Validation,
  );
  if (!coordinates) return;

  let volumeCurveId: CurveId | undefined = undefined;
  if (tankData.volumeCurveId) {
    const curveId = curvesContext.labelManager.getIdByLabel(
      tankData.volumeCurveId,
      "curve",
    );
    if (curveId !== undefined) {
      volumeCurveId = curveId;
      markCurveUsed(curvesContext, curveId, "volume");
    }
  }

  const initialWaterAge =
    inpData.options.qualitySimulationType === "AGE"
      ? inpData.quality.get(tankData.id)
      : undefined;

  const mixingData = inpData.mixing.get(tankData.id);
  const mixingModel = mixingData?.model as TankMixingModel | undefined;

  const tank = assetFactory.createTank({
    label: tankData.id,
    coordinates,
    elevation: tankData.elevation,
    initialLevel: tankData.initialLevel,
    minLevel: tankData.minLevel,
    maxLevel: tankData.maxLevel,
    diameter: tankData.diameter,
    minVolume: tankData.minVolume,
    overflow: tankData.overflow ?? false,
    mixingModel,
    mixingFraction: mixingData?.fraction,
    volumeCurveId,
    initialWaterAge,
    isActive: tankData.isActive,
  });
  hydraulicModel.assets.set(tank.id, tank);
  nodeIds.set(tankData.id, tank.id);
};

const addPump = (
  assetFactory: AssetFactory,
  hydraulicModel: HydraulicModel,
  pumpData: PumpData,
  curvesContext: CurvesContext,
  patternContext: PatternsContext,
  {
    inpData,
    issues,
    nodeIds,
    linkIds,
    skipWgs84Validation,
  }: {
    inpData: InpData;
    issues: IssuesAccumulator;
    nodeIds: ItemData<AssetId>;
    linkIds: ItemData<AssetId>;
    skipWgs84Validation: boolean;
  },
) => {
  const linkProperties = getLinkProperties(
    inpData,
    issues,
    nodeIds,
    pumpData,
    skipWgs84Validation,
  );
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
        curve: defaultCurvePoints("pump"),
      };
    } else {
      const curve = curvesContext.curves.get(curveId)!;
      if (!isValidCurve(curve.points)) {
        issues.addInvalidPumpCurve();
      }
      const effectiveCurveId = markCurveUsed(curvesContext, curve.id, "pump");

      definitionProps = {
        definitionType: "curveId",
        curveId: effectiveCurveId,
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

  let speedPatternId: PatternId | undefined;
  if (pumpData.patternId) {
    const patternId = patternContext.labelManager.getIdByLabel(
      pumpData.patternId,
      "pattern",
    );
    if (patternId !== undefined) {
      speedPatternId = markPatternUsed(patternContext, patternId, "pumpSpeed");
    }
  }

  const pumpEnergyData = inpData.energy.pumpEnergy.get(pumpData.id);

  let efficiencyCurveId: CurveId | undefined;
  if (pumpEnergyData?.efficiencyCurve) {
    const curveId = curvesContext.labelManager.getIdByLabel(
      pumpEnergyData.efficiencyCurve,
      "curve",
    );
    if (curveId !== undefined) {
      efficiencyCurveId = markCurveUsed(curvesContext, curveId, "efficiency");
    }
  }

  let energyPricePatternId: PatternId | undefined;
  if (pumpEnergyData?.pattern) {
    const patternId = patternContext.labelManager.getIdByLabel(
      pumpEnergyData.pattern,
      "pattern",
    );
    if (patternId !== undefined) {
      energyPricePatternId = markPatternUsed(
        patternContext,
        patternId,
        "energyPrice",
      );
    }
  }

  const energyPrice = pumpEnergyData?.price;

  const pump = assetFactory.createPump({
    label: pumpData.id,
    connections,
    ...definitionProps,
    initialStatus,
    speed,
    speedPatternId,
    efficiencyCurveId,
    energyPrice,
    energyPricePatternId,
    coordinates,
    isActive: pumpData.isActive,
  });
  hydraulicModel.assets.set(pump.id, pump);
  hydraulicModel.topology.addLink(pump.id, connections[0], connections[1]);
  linkIds.set(pumpData.id, pump.id);
  if (pump.curveId) {
    if (!curvesContext.pumpCurves.has(pump.curveId)) {
      curvesContext.pumpCurves.set(pump.curveId, []);
    }
    curvesContext.pumpCurves.get(pump.curveId)!.push(pump.id);
  }
};

const addValve = (
  assetFactory: AssetFactory,
  hydraulicModel: HydraulicModel,
  valveData: ValveData,
  curvesContext: CurvesContext,
  {
    inpData,
    issues,
    nodeIds,
    linkIds,
    skipWgs84Validation,
  }: {
    inpData: InpData;
    issues: IssuesAccumulator;
    nodeIds: ItemData<AssetId>;
    linkIds: ItemData<AssetId>;
    skipWgs84Validation: boolean;
  },
) => {
  const linkProperties = getLinkProperties(
    inpData,
    issues,
    nodeIds,
    valveData,
    skipWgs84Validation,
  );
  if (!linkProperties) return;
  const { connections, coordinates } = linkProperties;

  let initialStatus: ValveStatus = "active";
  if (inpData.status.has(valveData.id)) {
    const statusValue = inpData.status.get(valveData.id) as string;
    initialStatus = statusValue === "CLOSED" ? "closed" : "open";
  }

  let resolvedCurveId: CurveId | undefined;
  if (valveData.curveId) {
    const curveId = curvesContext.labelManager.getIdByLabel(
      valveData.curveId,
      "curve",
    );
    if (curveId !== undefined) {
      resolvedCurveId = curveId;
      const curveType = valveData.kind === "pcv" ? "valve" : "headloss";
      markCurveUsed(curvesContext, curveId, curveType);
    }
  }
  const valve = assetFactory.createValve({
    label: valveData.id,
    diameter: valveData.diameter,
    minorLoss: valveData.minorLoss,
    kind: valveData.kind,
    setting: valveData.kind === "gpv" ? undefined : valveData.setting,
    initialStatus,
    connections,
    coordinates,
    isActive: valveData.isActive,
    curveId: resolvedCurveId,
  });
  hydraulicModel.assets.set(valve.id, valve);
  hydraulicModel.topology.addLink(valve.id, connections[0], connections[1]);
  linkIds.set(valveData.id, valve.id);
};

const addPipe = (
  assetFactory: AssetFactory,
  hydraulicModel: HydraulicModel,
  pipeData: PipeData,
  {
    inpData,
    issues,
    nodeIds,
    linkIds,
    options: _options,
    skipWgs84Validation,
  }: {
    inpData: InpData;
    issues: IssuesAccumulator;
    nodeIds: ItemData<AssetId>;
    linkIds: ItemData<AssetId>;
    options?: ParseInpOptions;
    skipWgs84Validation: boolean;
  },
) => {
  const linkProperties = getLinkProperties(
    inpData,
    issues,
    nodeIds,
    pipeData,
    skipWgs84Validation,
  );
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

  const pipe = assetFactory.createPipe({
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
  patternContext: PatternsContext,
  {
    inpData,
    nodeIds,
    linkIds,
    customerPointFactory,
  }: {
    inpData: InpData;
    nodeIds: ItemData<AssetId>;
    linkIds: ItemData<AssetId>;
    customerPointFactory: CustomerPointFactory;
  },
) => {
  const rawDemands =
    customerPointData.demands ??
    inpData.customerDemands.get(customerPointData.label) ??
    (customerPointData.baseDemand
      ? [{ baseDemand: customerPointData.baseDemand }]
      : []);

  const demands = rawDemands.map((d) =>
    buildDemand(patternContext, d.baseDemand, d.patternLabel),
  );

  const customerPoint = customerPointFactory.create(
    customerPointData.coordinates,
    customerPointData.label,
  );

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

  hydraulicModel.customerPoints.set(customerPoint.id, customerPoint);
  hydraulicModel.demands.customerPoints.set(customerPoint.id, demands);
};

const getLinkProperties = (
  inpData: InpData,
  issues: IssuesAccumulator,
  nodeIds: ItemData<AssetId>,
  linkData: { id: string; startNodeDirtyId: string; endNodeDirtyId: string },
  skipWgs84Validation: boolean,
) => {
  if (!linkData.startNodeDirtyId || !linkData.endNodeDirtyId) return null;

  const startCoordinates = getNodeCoordinates(
    inpData,
    linkData.startNodeDirtyId,
    issues,
    skipWgs84Validation,
  );
  const endCoordinates = getNodeCoordinates(
    inpData,
    linkData.endNodeDirtyId,
    issues,
    skipWgs84Validation,
  );
  const vertices = getVertices(
    inpData,
    linkData.id,
    issues,
    skipWgs84Validation,
  );

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
  skipWgs84Validation: boolean,
) => {
  const candidates = inpData.vertices.get(linkId) || [];
  if (skipWgs84Validation) return candidates;
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
  skipWgs84Validation: boolean,
): Position | null => {
  const nodeCoordinates = inpData.coordinates.get(nodeId);
  if (!nodeCoordinates) {
    issues.addMissingCoordinates(nodeId);
    return null;
  }
  if (!skipWgs84Validation && !isWgs84(nodeCoordinates)) {
    issues.addInvalidCoordinates(nodeId);
    return null;
  }
  return nodeCoordinates;
};

export const isWgs84 = (coordinates: Position) =>
  coordinates[0] >= -180 &&
  coordinates[0] <= 180 &&
  coordinates[1] >= -90 &&
  coordinates[1] <= 90;

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
  context: CurvesContext,
  curveId: CurveId,
  type: CurveType,
): CurveId => {
  const curve = context.curves.get(curveId)!;

  if (!curve.type) {
    curve.type = type;
    return curveId;
  }

  if (curve.type === type) {
    return curveId;
  }

  let typeDuplicates = context.duplicates.get(curveId);
  if (typeDuplicates?.has(type)) {
    return typeDuplicates.get(type)!;
  }

  const newLabel = context.labelManager.generateNextLabel(curve.label);
  const duplicate = addCurve(
    context,
    newLabel,
    curve.points.map((p) => ({ ...p })),
  );
  if (!duplicate) return curveId;

  duplicate.type = type;

  if (!typeDuplicates) {
    typeDuplicates = new Map();
    context.duplicates.set(curveId, typeDuplicates);
  }
  typeDuplicates.set(type, duplicate.id);

  return duplicate.id;
};

const addCurves = (
  hydraulicModel: HydraulicModel,
  labelManager: LabelManager,
  curvesContext: CurvesContext,
  issues: IssuesAccumulator,
  rawCurves: ItemData<CurveData>,
) => {
  const { curves, pumpCurves } = curvesContext;

  for (const curve of curves.values()) {
    if (!curve.type) {
      const raw = rawCurves.get(curve.label);
      if (raw?.fallbackType) curve.type = raw.fallbackType;
    }
  }

  const validCurves: Curves = new Map();

  for (const curve of curves.values()) {
    if (curve.type === "pump") {
      const curveType = getCurvePointsType(curve.points);
      const curvePumps = pumpCurves.get(curve.id) || [];
      if (curveType === "multiPointCurve" || curvePumps.length !== 1) {
        validCurves.set(curve.id, curve);
        continue;
      }

      const [pumpId] = curvePumps;
      const pump = hydraulicModel.assets.get(pumpId) as Pump;
      pump.setProperty("definitionType", "curve");
      pump.feature.properties.curve = curve.points.map((p) => ({ ...p }));
      pump.setProperty("curveId", undefined);
      labelManager.remove(curve.label, "curve", curve.id);
      continue;
    }

    validCurves.set(curve.id, curve);
  }
  hydraulicModel.curves = validCurves;
};

const addPatterns = (
  hydraulicModel: HydraulicModel,
  labelManager: LabelManager,
  patternContext: PatternsContext,
  sourceStrengthPatterns: Set<string>,
  globalEnergyPattern: string | undefined,
  rawPatterns: ItemData<PatternData>,
) => {
  const { patterns } = patternContext;

  for (const label of sourceStrengthPatterns) {
    const patternId = labelManager.getIdByLabel(label, "pattern");
    if (patternId !== undefined) {
      markPatternUsed(patternContext, patternId, "qualitySourceStrength");
    }
  }

  if (globalEnergyPattern) {
    const patternId = labelManager.getIdByLabel(globalEnergyPattern, "pattern");
    if (patternId !== undefined) {
      markPatternUsed(patternContext, patternId, "energyPrice");
    }
  }

  for (const pattern of patterns.values()) {
    if (!pattern.type) {
      const raw = rawPatterns.get(pattern.label);
      if (raw?.fallbackType) pattern.type = raw.fallbackType;
    }
  }

  hydraulicModel.patterns = patterns;
};

const markPatternUsed = (
  context: PatternsContext,
  patternId: PatternId,
  type: PatternType,
): PatternId => {
  const pattern = context.patterns.get(patternId)!;

  if (!pattern.type) {
    pattern.type = type;
    return patternId;
  }

  if (pattern.type === type) {
    return patternId;
  }

  let typeDuplicates = context.duplicates.get(patternId);
  if (typeDuplicates?.has(type)) {
    return typeDuplicates.get(type)!;
  }

  const newLabel = context.labelManager.generateNextLabel(pattern.label);
  const duplicate = addPattern(context, newLabel, [...pattern.multipliers]);
  if (!duplicate) return patternId;

  duplicate.type = type;

  if (!typeDuplicates) {
    typeDuplicates = new Map();
    context.duplicates.set(patternId, typeDuplicates);
  }
  typeDuplicates.set(type, duplicate.id);

  return duplicate.id;
};
