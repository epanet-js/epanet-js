import { CategoryStats } from "../asset-property-stats";

import { Quantities } from "src/model-metadata/quantities-spec";
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
import {
  AssetPropertyStats,
  AssetCounts,
  ComputedMultiAssetData,
  QuantityStats,
  AssetPropertySections,
} from "./data";

const calculateCustomerPointsDemand = (
  customerPoints: CustomerPoint[],
  patterns: DemandPatterns,
): number => {
  return customerPoints.reduce(
    (sum, cp) => sum + calculateAverageDemand(cp.demands, patterns),
    0,
  );
};

export const computeMultiAssetDataWithCustomerDemands = (
  assets: Asset[],
  quantitiesMetadata: Quantities,
  hydraulicModel: HydraulicModel,
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
        );
        break;
      case "pump":
        counts.pump++;
        appendPumpStats(statsMaps.pump, asset as Pump, quantitiesMetadata);
        break;
      case "valve":
        counts.valve++;
        appendValveStats(statsMaps.valve, asset as Valve, quantitiesMetadata);
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
        appendTankStats(statsMaps.tank, asset as Tank, quantitiesMetadata);
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
) => {
  updateCategoryStats(statsMap, "isEnabled", junction.isActive ? "yes" : "no");
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

  if (junction.pressure !== null) {
    updateQuantityStats(
      statsMap,
      "pressure",
      junction.pressure,
      quantitiesMetadata,
    );
  }
  if (junction.head !== null) {
    updateQuantityStats(statsMap, "head", junction.head, quantitiesMetadata);
  }
  if (junction.actualDemand !== null) {
    updateQuantityStats(
      statsMap,
      "actualDemand",
      junction.actualDemand,
      quantitiesMetadata,
    );
  }
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
) => {
  updateCategoryStats(statsMap, "isEnabled", pipe.isActive ? "yes" : "no");
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

  if (pipe.flow !== null) {
    updateQuantityStats(statsMap, "flow", pipe.flow, quantitiesMetadata);
  }
  if (pipe.velocity !== null) {
    updateQuantityStats(
      statsMap,
      "velocity",
      pipe.velocity,
      quantitiesMetadata,
    );
  }
  if (pipe.unitHeadloss !== null) {
    updateQuantityStats(
      statsMap,
      "unitHeadloss",
      pipe.unitHeadloss,
      quantitiesMetadata,
    );
  }
  if (pipe.headloss !== null) {
    updateQuantityStats(
      statsMap,
      "headloss",
      pipe.headloss,
      quantitiesMetadata,
    );
  }
  if (pipe.status !== null) {
    const statusLabel = "pipe." + pipe.status;
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
) => {
  updateCategoryStats(statsMap, "isEnabled", pump.isActive ? "yes" : "no");
  updateCategoryStats(statsMap, "pumpType", pump.definitionType);
  updateCategoryStats(statsMap, "initialStatus", "pump." + pump.initialStatus);

  if (pump.speed !== null) {
    updateQuantityStats(statsMap, "speed", pump.speed, quantitiesMetadata);
  }
  if (pump.flow !== null) {
    updateQuantityStats(statsMap, "flow", pump.flow, quantitiesMetadata);
  }
  if (pump.head !== null) {
    updateQuantityStats(statsMap, "pumpHead", pump.head, quantitiesMetadata);
  }
  if (pump.status !== null) {
    const statusLabel = pump.statusWarning
      ? `pump.${pump.status}.${pump.statusWarning}`
      : "pump." + pump.status;
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
) => {
  updateCategoryStats(statsMap, "isEnabled", valve.isActive ? "yes" : "no");
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

  if (valve.flow !== null) {
    updateQuantityStats(statsMap, "flow", valve.flow, quantitiesMetadata);
  }
  if (valve.velocity !== null) {
    updateQuantityStats(
      statsMap,
      "velocity",
      valve.velocity,
      quantitiesMetadata,
    );
  }
  if (valve.headloss !== null) {
    updateQuantityStats(
      statsMap,
      "headloss",
      valve.headloss,
      quantitiesMetadata,
    );
  }
  if (valve.status !== null) {
    const statusLabel = `valve.${valve.status}`;
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
  updateCategoryStats(statsMap, "isEnabled", reservoir.isActive ? "yes" : "no");
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
) => {
  updateCategoryStats(statsMap, "isEnabled", tank.isActive ? "yes" : "no");
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
    updateCategoryStats(statsMap, "canOverflow", tank.overflow ? "yes" : "no");
  }

  if (tank.pressure !== null) {
    updateQuantityStats(
      statsMap,
      "pressure",
      tank.pressure,
      quantitiesMetadata,
    );
  }
  if (tank.head !== null) {
    updateQuantityStats(statsMap, "head", tank.head, quantitiesMetadata);
  }
  if (tank.level !== null) {
    updateQuantityStats(statsMap, "level", tank.level, quantitiesMetadata);
  }
  if (tank.volume !== null) {
    updateQuantityStats(statsMap, "volume", tank.volume, quantitiesMetadata);
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
