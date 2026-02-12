import { Unit } from "src/quantity";
import { Quantities } from "src/model-metadata/quantities-spec";
import type { ResultsReader } from "src/simulation/results-reader";
import {
  Asset,
  Junction,
  Pipe,
  Pump,
  Reservoir,
  Tank,
  HydraulicModel,
} from "src/hydraulic-model";
import { Valve } from "src/hydraulic-model/asset-types";
import { getPumpCurveType } from "src/hydraulic-model/curves";
import { CustomerPointsLookup } from "src/hydraulic-model/customer-points-lookup";
import {
  CustomerPoint,
  getActiveCustomerPoints,
} from "src/hydraulic-model/customer-points";
import {
  DemandPatterns,
  Demands,
  calculateAverageDemand,
} from "src/hydraulic-model/demands";

export type QuantityStats = {
  type: "quantity";
  property: string;
  sum: number;
  max: number;
  min: number;
  mean: number;
  values: Map<number, number>;
  times: number;
  decimals: number;
  unit: Unit;
};

export type CategoryStats = {
  type: "category";
  property: string;
  values: Map<string, number>;
};

export type BooleanStats = {
  type: "boolean";
  property: string;
  values: Map<string, number>;
};

type Section =
  | "activeTopology"
  | "modelAttributes"
  | "simulationResults"
  | "demands";

export type AssetPropertyStats = QuantityStats | CategoryStats | BooleanStats;

export type AssetPropertySections = {
  [section in Section]: AssetPropertyStats[];
};

export type MultiAssetsData = {
  [type in Asset["type"]]: AssetPropertySections;
};

export type AssetCounts = {
  [type in Asset["type"]]: number;
};

export type ComputedMultiAssetData = {
  data: MultiAssetsData;
  counts: AssetCounts;
};

export const computeMultiAssetData = (
  assets: Asset[],
  quantitiesMetadata: Quantities,
  hydraulicModel: HydraulicModel,
  simulationResults?: ResultsReader | null,
): ComputedMultiAssetData => {
  const counts: AssetCounts = {
    junction: 0,
    pipe: 0,
    pump: 0,
    valve: 0,
    reservoir: 0,
    tank: 0,
  };

  const statsMaps = {
    junction: new Map<string, AssetPropertyStats>(),
    pipe: new Map<string, AssetPropertyStats>(),
    pump: new Map<string, AssetPropertyStats>(),
    valve: new Map<string, AssetPropertyStats>(),
    reservoir: new Map<string, AssetPropertyStats>(),
    tank: new Map<string, AssetPropertyStats>(),
  };

  for (const asset of assets) {
    switch (asset.type) {
      case "junction":
        counts.junction++;
        appendJunctionStats(
          statsMaps.junction,
          asset as Junction,
          quantitiesMetadata,
          hydraulicModel.customerPointsLookup,
          hydraulicModel.assets,
          hydraulicModel.demands,
          simulationResults,
        );
        break;
      case "pipe":
        counts.pipe++;
        appendPipeStats(
          statsMaps.pipe,
          asset as Pipe,
          quantitiesMetadata,
          hydraulicModel.customerPointsLookup,
          hydraulicModel.demands,
          simulationResults,
        );
        break;
      case "pump":
        counts.pump++;
        appendPumpStats(
          statsMaps.pump,
          asset as Pump,
          quantitiesMetadata,
          simulationResults,
        );
        break;
      case "valve":
        counts.valve++;
        appendValveStats(
          statsMaps.valve,
          asset as Valve,
          quantitiesMetadata,
          simulationResults,
        );
        break;
      case "reservoir":
        counts.reservoir++;
        appendReservoirStats(
          statsMaps.reservoir,
          asset as Reservoir,
          quantitiesMetadata,
        );
        break;
      case "tank":
        counts.tank++;
        appendTankStats(
          statsMaps.tank,
          asset as Tank,
          quantitiesMetadata,
          simulationResults,
        );
        break;
    }
  }

  return {
    data: {
      junction: buildJunctionSections(statsMaps.junction),
      pipe: buildPipeSections(statsMaps.pipe),
      pump: buildPumpSections(statsMaps.pump),
      valve: buildValveSections(statsMaps.valve),
      reservoir: buildReservoirSections(statsMaps.reservoir),
      tank: buildTankSections(statsMaps.tank),
    },
    counts,
  };
};

const appendJunctionStats = (
  statsMap: Map<string, AssetPropertyStats>,
  junction: Junction,
  quantitiesMetadata: Quantities,
  customerPointsLookup: CustomerPointsLookup,
  assets: HydraulicModel["assets"],
  demands: Demands,
  simulationResults?: ResultsReader | null,
) => {
  updateBooleanStats(statsMap, "isEnabled", junction.isActive);
  updateQuantityStats(
    statsMap,
    "elevation",
    junction.elevation,
    quantitiesMetadata,
  );

  const averageDemand = calculateAverageDemand(
    junction.demands,
    demands.patterns,
  );
  updateQuantityStats(
    statsMap,
    "directDemand",
    averageDemand,
    quantitiesMetadata,
  );

  const customerPoints = getActiveCustomerPoints(
    customerPointsLookup,
    assets,
    junction.id,
  );

  if (customerPoints.length > 0) {
    const totalCustomerDemand = calculateCustomerPointsDemand(
      customerPoints,
      demands.patterns,
    );

    updateQuantityStats(
      statsMap,
      "customerDemand",
      totalCustomerDemand,
      quantitiesMetadata,
    );

    updateCustomerCountStats(
      statsMap,
      "connectedCustomers",
      customerPoints.length,
    );
  }

  // Simulation results - read from ResultsReader
  const junctionSim = simulationResults?.getJunction(junction.id);
  const pressure = junctionSim?.pressure ?? null;
  const head = junctionSim?.head ?? null;
  const actualDemand = junctionSim?.demand ?? null;

  if (pressure !== null) {
    updateQuantityStats(statsMap, "pressure", pressure, quantitiesMetadata);
  }
  if (head !== null) {
    updateQuantityStats(statsMap, "head", head, quantitiesMetadata);
  }
  if (actualDemand !== null) {
    updateQuantityStats(
      statsMap,
      "actualDemand",
      actualDemand,
      quantitiesMetadata,
    );
  }
};

const calculateCustomerPointsDemand = (
  customerPoints: CustomerPoint[],
  patterns: DemandPatterns,
): number => {
  return customerPoints.reduce(
    (sum, cp) => sum + calculateAverageDemand(cp.demands, patterns),
    0,
  );
};

const buildJunctionSections = (
  statsMap: Map<string, AssetPropertyStats>,
): AssetPropertySections => {
  return {
    activeTopology: getStatsForProperties(statsMap, ["isEnabled"]),
    modelAttributes: getStatsForProperties(statsMap, ["elevation"]),
    demands: getStatsForProperties(statsMap, [
      "directDemand",
      "customerDemand",
      "connectedCustomers",
    ]),
    simulationResults: getStatsForProperties(statsMap, [
      "pressure",
      "head",
      "actualDemand",
    ]),
  };
};

const appendPipeStats = (
  statsMap: Map<string, AssetPropertyStats>,
  pipe: Pipe,
  quantitiesMetadata: Quantities,
  customerPointsLookup: CustomerPointsLookup,
  demands: Demands,
  simulationResults?: ResultsReader | null,
) => {
  updateBooleanStats(statsMap, "isEnabled", pipe.isActive);
  updateCategoryStats(statsMap, "initialStatus", "pipe." + pipe.initialStatus);
  updateQuantityStats(statsMap, "diameter", pipe.diameter, quantitiesMetadata);
  updateQuantityStats(statsMap, "length", pipe.length, quantitiesMetadata);
  updateQuantityStats(
    statsMap,
    "roughness",
    pipe.roughness,
    quantitiesMetadata,
  );
  updateQuantityStats(
    statsMap,
    "minorLoss",
    pipe.minorLoss,
    quantitiesMetadata,
  );

  const customerPoints = customerPointsLookup.getCustomerPoints(pipe.id);
  if (customerPoints.size > 0) {
    const totalCustomerDemand = calculateCustomerPointsDemand(
      Array.from(customerPoints),
      demands.patterns,
    );

    updateQuantityStats(
      statsMap,
      "customerDemand",
      totalCustomerDemand,
      quantitiesMetadata,
    );

    updateCustomerCountStats(
      statsMap,
      "connectedCustomers",
      customerPoints.size,
    );
  }

  // Simulation results - read from ResultsReader
  const pipeSim = simulationResults?.getPipe(pipe.id);
  const flow = pipeSim?.flow ?? null;
  const velocity = pipeSim?.velocity ?? null;
  const unitHeadloss = pipeSim?.unitHeadloss ?? null;
  const headloss = pipeSim?.headloss ?? null;
  const status = pipeSim?.status ?? null;

  if (flow !== null) {
    updateQuantityStats(statsMap, "flow", flow, quantitiesMetadata);
  }
  if (velocity !== null) {
    updateQuantityStats(statsMap, "velocity", velocity, quantitiesMetadata);
  }
  if (unitHeadloss !== null) {
    updateQuantityStats(
      statsMap,
      "unitHeadloss",
      unitHeadloss,
      quantitiesMetadata,
    );
  }
  if (headloss !== null) {
    updateQuantityStats(statsMap, "headloss", headloss, quantitiesMetadata);
  }
  if (status !== null) {
    const statusLabel = "pipe." + status;
    updateCategoryStats(statsMap, "pipeStatus", statusLabel);
  }
};

const buildPipeSections = (
  statsMap: Map<string, AssetPropertyStats>,
): AssetPropertySections => {
  return {
    activeTopology: getStatsForProperties(statsMap, ["isEnabled"]),
    modelAttributes: getStatsForProperties(statsMap, [
      "initialStatus",
      "diameter",
      "length",
      "roughness",
      "minorLoss",
    ]),
    demands: getStatsForProperties(statsMap, [
      "customerDemand",
      "connectedCustomers",
    ]),
    simulationResults: getStatsForProperties(statsMap, [
      "flow",
      "velocity",
      "unitHeadloss",
      "headloss",
      "pipeStatus",
    ]),
  };
};

const appendPumpStats = (
  statsMap: Map<string, AssetPropertyStats>,
  pump: Pump,
  quantitiesMetadata: Quantities,
  simulationResults?: ResultsReader | null,
) => {
  updateBooleanStats(statsMap, "isEnabled", pump.isActive);

  let pumpType: string = pump.definitionType;
  if (pump.definitionType === "curve" && pump.curve) {
    const curveType = getPumpCurveType(pump.curve);
    if (curveType === "designPointCurve" || curveType === "standardCurve") {
      pumpType = curveType;
    }
  }
  updateCategoryStats(statsMap, "pumpType", pumpType);
  updateCategoryStats(statsMap, "initialStatus", "pump." + pump.initialStatus);

  if (pump.speed !== null) {
    updateQuantityStats(statsMap, "speed", pump.speed, quantitiesMetadata);
  }

  // Simulation results - read from ResultsReader
  const pumpSim = simulationResults?.getPump(pump.id);
  const flow = pumpSim?.flow ?? null;
  // pump head = -pumpSimulation.headloss
  const head = pumpSim ? -pumpSim.headloss : null;
  const status = pumpSim?.status ?? null;
  const statusWarning = pumpSim?.statusWarning ?? null;

  if (flow !== null) {
    updateQuantityStats(statsMap, "flow", flow, quantitiesMetadata);
  }
  if (head !== null) {
    updateQuantityStats(statsMap, "pumpHead", head, quantitiesMetadata);
  }
  if (status !== null) {
    const statusLabel = statusWarning
      ? `pump.${status}.${statusWarning}`
      : "pump." + status;
    updateCategoryStats(statsMap, "pumpStatus", statusLabel);
  }
};

const buildPumpSections = (
  statsMap: Map<string, AssetPropertyStats>,
): AssetPropertySections => {
  return {
    activeTopology: getStatsForProperties(statsMap, ["isEnabled"]),
    modelAttributes: getStatsForProperties(statsMap, [
      "pumpType",
      "initialStatus",
      "speed",
    ]),
    demands: [],
    simulationResults: getStatsForProperties(statsMap, [
      "flow",
      "pumpHead",
      "pumpStatus",
    ]),
  };
};

const appendValveStats = (
  statsMap: Map<string, AssetPropertyStats>,
  valve: Valve,
  quantitiesMetadata: Quantities,
  simulationResults?: ResultsReader | null,
) => {
  updateBooleanStats(statsMap, "isEnabled", valve.isActive);
  updateCategoryStats(statsMap, "valveType", `valve.${valve.kind}`);
  updateCategoryStats(
    statsMap,
    "initialStatus",
    "valve." + valve.initialStatus,
  );
  updateQuantityStats(statsMap, "setting", valve.setting, quantitiesMetadata);
  updateQuantityStats(statsMap, "diameter", valve.diameter, quantitiesMetadata);
  updateQuantityStats(
    statsMap,
    "minorLoss",
    valve.minorLoss,
    quantitiesMetadata,
  );

  // Simulation results - read from ResultsReader
  const valveSim = simulationResults?.getValve(valve.id);
  const flow = valveSim?.flow ?? null;
  const velocity = valveSim?.velocity ?? null;
  const headloss = valveSim?.headloss ?? null;
  const status = valveSim?.status ?? null;

  if (flow !== null) {
    updateQuantityStats(statsMap, "flow", flow, quantitiesMetadata);
  }
  if (velocity !== null) {
    updateQuantityStats(statsMap, "velocity", velocity, quantitiesMetadata);
  }
  if (headloss !== null) {
    updateQuantityStats(statsMap, "headloss", headloss, quantitiesMetadata);
  }
  if (status !== null) {
    const statusLabel = `valve.${status}`;
    updateCategoryStats(statsMap, "valveStatus", statusLabel);
  }
};

const buildValveSections = (
  statsMap: Map<string, AssetPropertyStats>,
): AssetPropertySections => {
  return {
    activeTopology: getStatsForProperties(statsMap, ["isEnabled"]),
    modelAttributes: getStatsForProperties(statsMap, [
      "valveType",
      "setting",
      "initialStatus",
      "diameter",
      "minorLoss",
    ]),
    demands: [],
    simulationResults: getStatsForProperties(statsMap, [
      "flow",
      "velocity",
      "headloss",
      "valveStatus",
    ]),
  };
};

const appendReservoirStats = (
  statsMap: Map<string, AssetPropertyStats>,
  reservoir: Reservoir,
  quantitiesMetadata: Quantities,
) => {
  updateBooleanStats(statsMap, "isEnabled", reservoir.isActive);
  updateQuantityStats(
    statsMap,
    "elevation",
    reservoir.elevation,
    quantitiesMetadata,
  );
  updateQuantityStats(statsMap, "head", reservoir.head, quantitiesMetadata);
};

const buildReservoirSections = (
  statsMap: Map<string, AssetPropertyStats>,
): AssetPropertySections => {
  return {
    activeTopology: getStatsForProperties(statsMap, ["isEnabled"]),
    modelAttributes: getStatsForProperties(statsMap, ["elevation", "head"]),
    demands: [],
    simulationResults: [],
  };
};

const appendTankStats = (
  statsMap: Map<string, AssetPropertyStats>,
  tank: Tank,
  quantitiesMetadata: Quantities,
  simulationResults?: ResultsReader | null,
) => {
  updateBooleanStats(statsMap, "isEnabled", tank.isActive);
  updateQuantityStats(
    statsMap,
    "elevation",
    tank.elevation,
    quantitiesMetadata,
  );
  updateQuantityStats(
    statsMap,
    "initialLevel",
    tank.initialLevel,
    quantitiesMetadata,
  );
  updateQuantityStats(statsMap, "minLevel", tank.minLevel, quantitiesMetadata);
  updateQuantityStats(statsMap, "maxLevel", tank.maxLevel, quantitiesMetadata);
  updateQuantityStats(statsMap, "diameter", tank.diameter, quantitiesMetadata);
  updateQuantityStats(
    statsMap,
    "minVolume",
    tank.minVolume,
    quantitiesMetadata,
  );

  if (tank.overflow !== undefined) {
    updateBooleanStats(statsMap, "canOverflow", tank.overflow);
  }

  // Simulation results - read from ResultsReader
  const tankSim = simulationResults?.getTank(tank.id);
  const pressure = tankSim?.pressure ?? null;
  const head = tankSim?.head ?? null;
  const level = tankSim?.level ?? null;
  const volume = tankSim?.volume ?? null;

  if (pressure !== null) {
    updateQuantityStats(statsMap, "pressure", pressure, quantitiesMetadata);
  }
  if (head !== null) {
    updateQuantityStats(statsMap, "head", head, quantitiesMetadata);
  }
  if (level !== null) {
    updateQuantityStats(statsMap, "level", level, quantitiesMetadata);
  }
  if (volume !== null) {
    updateQuantityStats(statsMap, "volume", volume, quantitiesMetadata);
  }
};

const buildTankSections = (
  statsMap: Map<string, AssetPropertyStats>,
): AssetPropertySections => {
  return {
    activeTopology: getStatsForProperties(statsMap, ["isEnabled"]),
    modelAttributes: getStatsForProperties(statsMap, [
      "elevation",
      "initialLevel",
      "minLevel",
      "maxLevel",
      "diameter",
      "minVolume",
      "canOverflow",
    ]),
    demands: [],
    simulationResults: getStatsForProperties(statsMap, [
      "pressure",
      "head",
      "level",
      "volume",
    ]),
  };
};

const updateQuantityStats = (
  statsMap: Map<string, AssetPropertyStats>,
  property: string,
  value: number | null,
  quantitiesMetadata: Quantities,
) => {
  if (value === null) return;

  if (!statsMap.has(property)) {
    const decimals =
      quantitiesMetadata.getDecimals(property as keyof Quantities["units"]) ||
      3;
    const unit = quantitiesMetadata.getUnit(
      property as keyof Quantities["units"],
    );

    statsMap.set(property, {
      type: "quantity",
      property,
      sum: 0,
      min: Infinity,
      max: -Infinity,
      mean: 0,
      values: new Map(),
      times: 0,
      decimals,
      unit,
    });
  }

  const stats = statsMap.get(property) as QuantityStats;
  const roundedValue = roundToDecimal(value, stats.decimals);

  if (roundedValue < stats.min) stats.min = roundedValue;
  if (roundedValue > stats.max) stats.max = roundedValue;

  stats.sum += roundedValue;
  stats.times += 1;
  stats.values.set(roundedValue, (stats.values.get(roundedValue) || 0) + 1);

  const mean = stats.sum / stats.times;
  stats.mean = roundToDecimal(mean, stats.decimals);
};

const updateCustomerCountStats = (
  statsMap: Map<string, AssetPropertyStats>,
  property: string,
  value: number,
) => {
  if (!statsMap.has(property)) {
    statsMap.set(property, {
      type: "quantity",
      property,
      sum: 0,
      min: Infinity,
      max: -Infinity,
      mean: 0,
      values: new Map(),
      times: 0,
      decimals: 0,
      unit: null,
    });
  }

  const stats = statsMap.get(property) as QuantityStats;

  if (value < stats.min) stats.min = value;
  if (value > stats.max) stats.max = value;

  stats.sum += value;
  stats.times += 1;
  stats.values.set(value, (stats.values.get(value) || 0) + 1);

  const mean = stats.sum / stats.times;
  stats.mean = roundToDecimal(mean, 0);
};

const updateCategoryStats = (
  statsMap: Map<string, AssetPropertyStats>,
  property: string,
  value: string,
) => {
  if (!statsMap.has(property)) {
    statsMap.set(property, {
      type: "category",
      property,
      values: new Map(),
    });
  }

  const stats = statsMap.get(property) as CategoryStats;
  stats.values.set(value, (stats.values.get(value) || 0) + 1);
};

const updateBooleanStats = (
  statsMap: Map<string, AssetPropertyStats>,
  property: string,
  value: boolean,
) => {
  if (!statsMap.has(property)) {
    statsMap.set(property, {
      type: "boolean",
      property,
      values: new Map(),
    });
  }

  const label = value ? "yes" : "no";
  const stats = statsMap.get(property) as BooleanStats;
  stats.values.set(label, (stats.values.get(label) || 0) + 1);
};

const getStatsForProperties = (
  statsMap: Map<string, AssetPropertyStats>,
  properties: string[],
): AssetPropertyStats[] => {
  const result: AssetPropertyStats[] = [];

  for (const property of properties) {
    const stats = statsMap.get(property);
    if (stats) {
      result.push(stats);
    }
  }

  return result;
};

const roundToDecimal = (value: number, decimals: number): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};
