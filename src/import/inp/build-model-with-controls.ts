import {
  HydraulicModel,
  initializeHydraulicModel,
  JunctionDemand,
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
} from "./inp-data";
import { IssuesAccumulator } from "./issues";
import { ModelMetadata } from "src/model-metadata";
import { Quantities, presets } from "src/model-metadata/quantities-spec";
import { Position } from "geojson";
import { PumpStatus } from "src/hydraulic-model/asset-types/pump";
import { ValveStatus } from "src/hydraulic-model/asset-types/valve";
import { ParseInpOptions } from "./parse-inp";
import { AssetId } from "src/hydraulic-model/asset-types/base-asset";
import { ConsecutiveIdsGenerator } from "src/hydraulic-model/id-generator";
import { CurvesBuilder } from "./curves-builder";
import { PatternsBuilder } from "./patterns-builder";
import { getPumpCurveType } from "src/hydraulic-model/curves";
import {
  LabelResolver,
  parseSimpleControlsFromText,
  parseRulesFromText,
} from "src/hydraulic-model/controls";

export const buildModelWithControls = (
  inpData: InpData,
  issues: IssuesAccumulator,
  options?: ParseInpOptions,
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
      multiplier: inpData.options.demandMultiplier,
      patterns: new Map(),
    },
    epsTiming: inpData.times,
  });

  const curvesBuilder = new CurvesBuilder(
    inpData.curves,
    issues,
    quantities.defaults,
  );

  const patternsBuilder = new PatternsBuilder(
    inpData.patterns,
    inpData.options.defaultPattern,
  );

  for (const junctionData of inpData.junctions) {
    addJunction(hydraulicModel, junctionData, {
      inpData,
      issues,
      nodeIds,
      patternsBuilder,
    });
  }

  for (const reservoirData of inpData.reservoirs) {
    addReservoir(hydraulicModel, reservoirData, {
      inpData,
      issues,
      nodeIds,
    });
  }

  for (const tankData of inpData.tanks) {
    addTank(hydraulicModel, tankData, {
      inpData,
      issues,
      nodeIds,
    });
  }

  for (const pumpData of inpData.pumps) {
    addPump(hydraulicModel, pumpData, curvesBuilder, {
      inpData,
      issues,
      nodeIds,
      linkIds,
    });
  }

  for (const valveData of inpData.valves) {
    addValve(hydraulicModel, valveData, {
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
    const id = customerPointIdGenerator.newId();

    const customerPoint = CustomerPoint.build(
      id,
      customerPointData.coordinates,
      {
        baseDemand: customerPointData.baseDemand,
        label: customerPointData.label,
      },
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

    hydraulicModel.customerPoints.set(id, customerPoint);
  }

  hydraulicModel.curves = curvesBuilder.getValidatedCurves();
  hydraulicModel.demands.patterns = patternsBuilder.getUsedPatterns();

  addControls(hydraulicModel, inpData.controls, nodeIds, linkIds);

  return { hydraulicModel, modelMetadata: { quantities } };
};

const addJunction = (
  hydraulicModel: HydraulicModel,
  junctionData: JunctionData,
  {
    inpData,
    issues,
    nodeIds,
    patternsBuilder,
  }: {
    inpData: InpData;
    issues: IssuesAccumulator;
    nodeIds: ItemData<AssetId>;
    patternsBuilder: PatternsBuilder;
  },
) => {
  const coordinates = getNodeCoordinates(inpData, junctionData.id, issues);
  if (!coordinates) return;

  let demands: JunctionDemand[] = [];

  if (junctionData.baseDemand) {
    const effectivePatternId = patternsBuilder.getEffectivePatternId(
      junctionData.patternId,
    );
    demands = [
      {
        baseDemand: junctionData.baseDemand,
        patternId: effectivePatternId,
      },
    ];
  }

  const junctionDemands = inpData.demands.get(junctionData.id) || [];
  if (junctionDemands.length > 0) {
    demands = [];

    junctionDemands.forEach((d) => {
      if (!d.baseDemand) return;
      const effectivePatternId = patternsBuilder.getEffectivePatternId(
        d.patternId,
      );
      demands.push({
        baseDemand: d.baseDemand,
        patternId: effectivePatternId,
      });
    });
  }

  for (const d of demands) {
    patternsBuilder.markPatternUsed(d.patternId);
  }

  const junction = hydraulicModel.assetBuilder.buildJunction({
    label: junctionData.id,
    coordinates,
    elevation: junctionData.elevation,
    demands,
    isActive: junctionData.isActive,
  });
  hydraulicModel.assets.set(junction.id, junction);
  nodeIds.set(junctionData.id, junction.id);
};

const addReservoir = (
  hydraulicModel: HydraulicModel,
  reservoirData: ReservoirData,
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
  const coordinates = getNodeCoordinates(inpData, reservoirData.id, issues);
  if (!coordinates) return;

  const reservoir = hydraulicModel.assetBuilder.buildReservoir({
    label: reservoirData.id,
    coordinates,
    head: calculateReservoirHead(reservoirData, inpData.patterns),
    isActive: reservoirData.isActive,
  });
  hydraulicModel.assets.set(reservoir.id, reservoir);
  nodeIds.set(reservoirData.id, reservoir.id);
};

const addTank = (
  hydraulicModel: HydraulicModel,
  tankData: TankData,
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
};

const addPump = (
  hydraulicModel: HydraulicModel,
  pumpData: PumpData,
  curvesBuilder: CurvesBuilder,
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
  const linkProperties = getLinkProperties(inpData, issues, nodeIds, pumpData);
  if (!linkProperties) return;

  const { coordinates, connections } = linkProperties;

  let definitionProps = {};

  if (pumpData.power !== undefined) {
    definitionProps = {
      definitionType: "power",
      power: pumpData.power,
      curveId: undefined,
    };
  }

  if (pumpData.curveId) {
    const curve = curvesBuilder.getPumpCurve(pumpData.curveId);
    definitionProps = {
      definitionType: getPumpCurveType(curve),
      curveId: curve.id,
    };
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
};

const addValve = (
  hydraulicModel: HydraulicModel,
  valveData: ValveData,
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

const getLinkProperties = (
  inpData: InpData,
  issues: IssuesAccumulator,
  nodeIds: ItemData<AssetId>,
  linkData: { id: string; startNodeDirtyId: string; endNodeDirtyId: string },
) => {
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
  return patterns.get(patternId || defaultPatternId) || [1];
};

const calculateReservoirHead = (
  reservoir: { id: string; baseHead: number; patternId?: string },
  patterns: InpData["patterns"],
): number => {
  let head = reservoir.baseHead;
  if (reservoir.patternId) {
    const pattern = getPattern(patterns, reservoir.patternId);
    head = reservoir.baseHead * pattern[0];
  }
  return head;
};

const LINK_KEYWORDS = ["LINK", "PIPE", "PUMP", "VALVE"];

const addControls = (
  hydraulicModel: HydraulicModel,
  rawControls: InpData["controls"],
  nodeIds: ItemData<AssetId>,
  linkIds: ItemData<AssetId>,
): void => {
  const resolveLabel: LabelResolver = (keyword, label) => {
    const isLinkKeyword = LINK_KEYWORDS.includes(keyword);
    return isLinkKeyword ? linkIds.get(label) : nodeIds.get(label);
  };

  hydraulicModel.controls = {
    simple: parseSimpleControlsFromText(rawControls.simple, resolveLabel),
    rules: parseRulesFromText(rawControls.ruleBased, resolveLabel),
  };
};
