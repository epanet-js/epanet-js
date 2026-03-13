import { Unit } from "src/quantity";
import { UnitsSpec, FormattingSpec } from "src/model-metadata/quantities-spec";
import { getDecimals } from "src/model-metadata";
import type { ResultsReader } from "src/simulation/results-reader";
import {
  Asset,
  AssetId,
  Junction,
  Pipe,
  Pump,
  Reservoir,
  Tank,
  HydraulicModel,
} from "src/hydraulic-model";
import { Valve } from "src/hydraulic-model/asset-types";
import { Curves, getCurvePointsType } from "src/hydraulic-model/curves";
import { CustomerPointsLookup } from "src/hydraulic-model/customer-points-lookup";
import {
  CustomerPoint,
  getActiveCustomerPoints,
} from "src/hydraulic-model/customer-points";
import {
  Patterns,
  Demands,
  calculateAverageDemand,
  calculateAverageHead,
  getCustomerPointDemands,
  getJunctionDemands,
} from "src/hydraulic-model";
import { tankVolumeCurveRange } from "src/hydraulic-model/asset-types/tank";

export type QuantityStats = {
  type: "quantity";
  property: string;
  sum: number;
  max: number;
  min: number;
  mean: number;
  values: Map<number, AssetId[]>;
  times: number;
  decimals: number;
  unit: Unit;
};

export type CategoryStats = {
  type: "category";
  property: string;
  values: Map<string, AssetId[]>;
};

export type LiteralCategoryStats = {
  type: "literalCategory";
  property: string;
  values: Map<string, AssetId[]>;
};

export type BooleanStats = {
  type: "boolean";
  property: string;
  values: Map<string, AssetId[]>;
};

type Section =
  | "activeTopology"
  | "modelAttributes"
  | "simulationResults"
  | "demands"
  | "energyResults";

export type AssetPropertyStats =
  | QuantityStats
  | CategoryStats
  | BooleanStats
  | LiteralCategoryStats;

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
  units: UnitsSpec,
  formatting: FormattingSpec,
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
          units,
          formatting,
          hydraulicModel.customerPointsLookup,
          hydraulicModel.assets,
          hydraulicModel.demands,
          hydraulicModel.patterns,
          simulationResults,
        );
        break;
      case "pipe":
        counts.pipe++;
        appendPipeStats(
          statsMaps.pipe,
          asset as Pipe,
          units,
          formatting,
          hydraulicModel.customerPointsLookup,
          hydraulicModel.demands,
          hydraulicModel.patterns,
          simulationResults,
        );
        break;
      case "pump":
        counts.pump++;
        appendPumpStats(
          statsMaps.pump,
          asset as Pump,
          units,
          formatting,
          hydraulicModel.curves,
          simulationResults,
        );
        break;
      case "valve":
        counts.valve++;
        appendValveStats(
          statsMaps.valve,
          asset as Valve,
          units,
          formatting,
          simulationResults,
        );
        break;
      case "reservoir":
        counts.reservoir++;
        appendReservoirStats(
          statsMaps.reservoir,
          asset as Reservoir,
          units,
          formatting,
          hydraulicModel.patterns,
          simulationResults,
        );
        break;
      case "tank":
        counts.tank++;
        appendTankStats(
          statsMaps.tank,
          asset as Tank,
          units,
          formatting,
          hydraulicModel.curves,
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
  units: UnitsSpec,
  formatting: FormattingSpec,
  customerPointsLookup: CustomerPointsLookup,
  assets: HydraulicModel["assets"],
  demands: Demands,
  patterns: Patterns,
  simulationResults?: ResultsReader | null,
) => {
  const id = junction.id;
  updateBooleanStats(statsMap, "isEnabled", junction.isActive, id);
  updateQuantityStats(
    statsMap,
    "elevation",
    junction.elevation,
    units,
    formatting,
    id,
  );
  updateQuantityStats(
    statsMap,
    "emitterCoefficient",
    junction.emitterCoefficient,
    units,
    formatting,
    id,
  );

  const averageDemand = calculateAverageDemand(
    getJunctionDemands(demands, junction.id),
    patterns,
  );
  updateQuantityStats(
    statsMap,
    "directDemand",
    averageDemand,
    units,
    formatting,
    id,
  );

  const customerPoints = getActiveCustomerPoints(
    customerPointsLookup,
    assets,
    junction.id,
  );

  if (customerPoints.length > 0) {
    const totalCustomerDemand = calculateCustomerPointsDemand(
      customerPoints,
      demands,
      patterns,
    );

    updateQuantityStats(
      statsMap,
      "customerDemand",
      totalCustomerDemand,
      units,
      formatting,
      id,
    );

    updateCustomerCountStats(
      statsMap,
      "connectedCustomers",
      customerPoints.length,
      id,
    );
  }

  // Simulation results - read from ResultsReader
  const junctionSim = simulationResults?.getJunction(junction.id);
  const pressure = junctionSim?.pressure ?? null;
  const head = junctionSim?.head ?? null;
  const actualDemand = junctionSim?.demand ?? null;

  if (pressure !== null) {
    updateQuantityStats(statsMap, "pressure", pressure, units, formatting, id);
  }
  if (head !== null) {
    updateQuantityStats(statsMap, "head", head, units, formatting, id);
  }
  if (actualDemand !== null) {
    updateQuantityStats(
      statsMap,
      "actualDemand",
      actualDemand,
      units,
      formatting,
      id,
    );
  }
};

const calculateCustomerPointsDemand = (
  customerPoints: CustomerPoint[],
  demands: Demands,
  patterns: Patterns,
): number => {
  return customerPoints.reduce(
    (sum, cp) =>
      sum +
      calculateAverageDemand(getCustomerPointDemands(demands, cp.id), patterns),
    0,
  );
};

const buildJunctionSections = (
  statsMap: Map<string, AssetPropertyStats>,
): AssetPropertySections => {
  return {
    activeTopology: getStatsForProperties(statsMap, ["isEnabled"]),
    modelAttributes: getStatsForProperties(statsMap, [
      "elevation",
      "emitterCoefficient",
    ]),
    demands: getStatsForProperties(statsMap, [
      "directDemand",
      "customerDemand",
      "connectedCustomers",
    ]),
    energyResults: [],
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
  units: UnitsSpec,
  formatting: FormattingSpec,
  customerPointsLookup: CustomerPointsLookup,
  demands: Demands,
  patterns: Patterns,
  simulationResults?: ResultsReader | null,
) => {
  const id = pipe.id;
  updateBooleanStats(statsMap, "isEnabled", pipe.isActive, id);
  updateCategoryStats(
    statsMap,
    "initialStatus",
    "pipe." + pipe.initialStatus,
    id,
  );
  updateQuantityStats(
    statsMap,
    "diameter",
    pipe.diameter,
    units,
    formatting,
    id,
  );
  updateQuantityStats(statsMap, "length", pipe.length, units, formatting, id);
  updateQuantityStats(
    statsMap,
    "roughness",
    pipe.roughness,
    units,
    formatting,
    id,
  );
  updateQuantityStats(
    statsMap,
    "minorLoss",
    pipe.minorLoss,
    units,
    formatting,
    id,
  );

  const customerPoints = customerPointsLookup.getCustomerPoints(pipe.id);
  if (customerPoints.size > 0) {
    const totalCustomerDemand = calculateCustomerPointsDemand(
      Array.from(customerPoints),
      demands,
      patterns,
    );

    updateQuantityStats(
      statsMap,
      "customerDemand",
      totalCustomerDemand,
      units,
      formatting,
      id,
    );

    updateCustomerCountStats(
      statsMap,
      "connectedCustomers",
      customerPoints.size,
      id,
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
    updateQuantityStats(statsMap, "flow", flow, units, formatting, id);
  }
  if (velocity !== null) {
    updateQuantityStats(statsMap, "velocity", velocity, units, formatting, id);
  }
  if (unitHeadloss !== null) {
    updateQuantityStats(
      statsMap,
      "unitHeadloss",
      unitHeadloss,
      units,
      formatting,
      id,
    );
  }
  if (headloss !== null) {
    updateQuantityStats(statsMap, "headloss", headloss, units, formatting, id);
  }
  if (status !== null) {
    const statusLabel = "pipe." + status;
    updateCategoryStats(statsMap, "pipeStatus", statusLabel, id);
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
    energyResults: [],
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
  units: UnitsSpec,
  formatting: FormattingSpec,
  curves: Curves,
  simulationResults?: ResultsReader | null,
) => {
  const id = pump.id;
  updateBooleanStats(statsMap, "isEnabled", pump.isActive, id);

  let pumpType: string = pump.definitionType;
  if (pump.definitionType === "curve" && pump.curve) {
    const curveType = getCurvePointsType(pump.curve);
    if (curveType === "designPointCurve" || curveType === "standardCurve") {
      pumpType = curveType;
    }
  }
  if (pump.definitionType === "curveId") pumpType = "namedCurve";
  updateCategoryStats(statsMap, "pumpType", pumpType, id);

  if (pump.definitionType === "curveId" && pump.curveId) {
    const curve = curves.get(pump.curveId);
    updateLinkStats(statsMap, "pumpName", curve?.label ?? "", id);
  } else {
    updateLinkStats(statsMap, "pumpName", "", id);
  }

  updateCategoryStats(
    statsMap,
    "initialStatus",
    "pump." + pump.initialStatus,
    id,
  );

  // Simulation results - read from ResultsReader
  const pumpSim = simulationResults?.getPump(pump.id);
  const flow = pumpSim?.flow ?? null;
  // pump head = -pumpSimulation.headloss
  const head = pumpSim ? -pumpSim.headloss : null;
  const status = pumpSim?.status ?? null;
  const statusWarning = pumpSim?.statusWarning ?? null;

  if (flow !== null) {
    updateQuantityStats(statsMap, "flow", flow, units, formatting, id);
  }
  if (head !== null) {
    updateQuantityStats(statsMap, "pumpHead", head, units, formatting, id);
  }
  if (status !== null) {
    const statusLabel = statusWarning
      ? `pump.${status}.${statusWarning}`
      : "pump." + status;
    updateCategoryStats(statsMap, "pumpStatus", statusLabel, id);
  }

  // Energy results
  const energy = simulationResults?.getPumpEnergy(pump.id);
  if (energy) {
    const percentUnit = {
      unit: units.efficiency,
      decimals: 2,
    };
    const powerUnit = {
      unit: units.power,
      decimals: 2,
    };
    const noUnit = { unit: null as Unit, decimals: 2 };

    updateQuantityStats(
      statsMap,
      "utilization",
      energy.utilization,
      units,
      formatting,
      id,
      percentUnit,
    );
    updateQuantityStats(
      statsMap,
      "averageEfficiency",
      energy.averageEfficiency,
      units,
      formatting,
      id,
      percentUnit,
    );
    updateQuantityStats(
      statsMap,
      "averageKwPerFlowUnit",
      energy.averageKwPerFlowUnit,
      units,
      formatting,
      id,
      { decimals: 2 },
    );
    updateQuantityStats(
      statsMap,
      "averageKw",
      energy.averageKw,
      units,
      formatting,
      id,
      powerUnit,
    );
    updateQuantityStats(
      statsMap,
      "peakKw",
      energy.peakKw,
      units,
      formatting,
      id,
      powerUnit,
    );
    updateQuantityStats(
      statsMap,
      "averageCostPerDay",
      energy.averageCostPerDay,
      units,
      formatting,
      id,
      noUnit,
    );
  }
};

const buildPumpSections = (
  statsMap: Map<string, AssetPropertyStats>,
): AssetPropertySections => {
  // Remove volumeCurve row if no tanks actually have curves
  const curveStats = statsMap.get("pumpName") as
    | LiteralCategoryStats
    | undefined;
  if (curveStats && curveStats.values.size === 1 && curveStats.values.has("")) {
    statsMap.delete("pumpName");
  }

  return {
    activeTopology: getStatsForProperties(statsMap, ["isEnabled"]),
    modelAttributes: getStatsForProperties(statsMap, [
      "pumpType",
      "pumpName",
      "initialStatus",
    ]),
    demands: [],
    energyResults: getStatsForProperties(statsMap, [
      "utilization",
      "averageEfficiency",
      "averageKwPerFlowUnit",
      "averageKw",
      "peakKw",
      "averageCostPerDay",
    ]),
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
  units: UnitsSpec,
  formatting: FormattingSpec,
  simulationResults?: ResultsReader | null,
) => {
  const id = valve.id;
  updateBooleanStats(statsMap, "isEnabled", valve.isActive, id);
  updateCategoryStats(statsMap, "valveType", `valve.${valve.kind}`, id);
  updateCategoryStats(
    statsMap,
    "initialStatus",
    "valve." + valve.initialStatus,
    id,
  );
  updateQuantityStats(
    statsMap,
    "setting",
    valve.setting,
    units,
    formatting,
    id,
  );
  updateQuantityStats(
    statsMap,
    "diameter",
    valve.diameter,
    units,
    formatting,
    id,
  );
  updateQuantityStats(
    statsMap,
    "minorLoss",
    valve.minorLoss,
    units,
    formatting,
    id,
  );

  // Simulation results - read from ResultsReader
  const valveSim = simulationResults?.getValve(valve.id);
  const flow = valveSim?.flow ?? null;
  const velocity = valveSim?.velocity ?? null;
  const headloss = valveSim?.headloss ?? null;
  const status = valveSim?.status ?? null;

  if (flow !== null) {
    updateQuantityStats(statsMap, "flow", flow, units, formatting, id);
  }
  if (velocity !== null) {
    updateQuantityStats(statsMap, "velocity", velocity, units, formatting, id);
  }
  if (headloss !== null) {
    updateQuantityStats(statsMap, "headloss", headloss, units, formatting, id);
  }
  if (status !== null) {
    const statusLabel = `valve.${status}`;
    updateCategoryStats(statsMap, "valveStatus", statusLabel, id);
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
    energyResults: [],
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
  units: UnitsSpec,
  formatting: FormattingSpec,
  patterns: Patterns,
  simulationResults?: ResultsReader | null,
) => {
  const id = reservoir.id;
  updateBooleanStats(statsMap, "isEnabled", reservoir.isActive, id);
  updateQuantityStats(
    statsMap,
    "elevation",
    reservoir.elevation,
    units,
    formatting,
    id,
  );

  const averageHead = calculateAverageHead(reservoir, patterns);
  updateQuantityStats(statsMap, "head", averageHead, units, formatting, id);

  const reservoirSim = simulationResults?.getReservoir(reservoir.id);
  const pressure = reservoirSim?.pressure ?? null;
  const simHead = reservoirSim?.head ?? null;
  const netFlow = reservoirSim?.netFlow ?? null;
  if (pressure !== null) {
    updateQuantityStats(statsMap, "pressure", pressure, units, formatting, id);
  }
  if (simHead !== null) {
    updateQuantityStats(statsMap, "actualHead", simHead, units, formatting, id);
  }
  if (netFlow !== null) {
    updateQuantityStats(statsMap, "netFlow", netFlow, units, formatting, id);
  }
};

const buildReservoirSections = (
  statsMap: Map<string, AssetPropertyStats>,
): AssetPropertySections => {
  return {
    activeTopology: getStatsForProperties(statsMap, ["isEnabled"]),
    modelAttributes: getStatsForProperties(statsMap, ["elevation", "head"]),
    demands: [],
    energyResults: [],
    simulationResults: getStatsForProperties(statsMap, [
      "pressure",
      "actualHead",
      "netFlow",
    ]),
  };
};

const appendTankStats = (
  statsMap: Map<string, AssetPropertyStats>,
  tank: Tank,
  units: UnitsSpec,
  formatting: FormattingSpec,
  curves: Curves,
  simulationResults?: ResultsReader | null,
) => {
  const id = tank.id;
  updateBooleanStats(statsMap, "isEnabled", tank.isActive, id);
  updateQuantityStats(
    statsMap,
    "elevation",
    tank.elevation,
    units,
    formatting,
    id,
  );
  updateQuantityStats(
    statsMap,
    "initialLevel",
    tank.initialLevel,
    units,
    formatting,
    id,
  );
  if (!tank.volumeCurveId) {
    updateQuantityStats(
      statsMap,
      "minLevel",
      tank.minLevel,
      units,
      formatting,
      id,
    );
    updateQuantityStats(
      statsMap,
      "maxLevel",
      tank.maxLevel,
      units,
      formatting,
      id,
    );
    updateQuantityStats(
      statsMap,
      "diameter",
      tank.diameter,
      units,
      formatting,
      id,
    );
    updateQuantityStats(
      statsMap,
      "minVolume",
      tank.minVolume,
      units,
      formatting,
      id,
    );
    updateQuantityStats(
      statsMap,
      "maxVolume",
      tank.maxVolume,
      units,
      formatting,
      id,
    );
    updateLinkStats(statsMap, "volumeCurve", "", id);
  } else {
    const curve = curves.get(tank.volumeCurveId);
    if (curve) {
      updateLinkStats(statsMap, "volumeCurve", curve.label, id);
      const range = tankVolumeCurveRange(curve);
      updateQuantityStats(
        statsMap,
        "minLevel",
        range.minLevel,
        units,
        formatting,
        id,
      );
      updateQuantityStats(
        statsMap,
        "maxLevel",
        range.maxLevel,
        units,
        formatting,
        id,
      );
      updateQuantityStats(
        statsMap,
        "minVolume",
        range.minVolume,
        units,
        formatting,
        id,
      );
      updateQuantityStats(
        statsMap,
        "maxVolume",
        range.maxVolume,
        units,
        formatting,
        id,
      );
    }
  }

  if (tank.overflow !== undefined) {
    updateBooleanStats(statsMap, "canOverflow", tank.overflow, id);
  }

  // Simulation results - read from ResultsReader
  const tankSim = simulationResults?.getTank(tank.id);
  const pressure = tankSim?.pressure ?? null;
  const head = tankSim?.head ?? null;
  const netFlow = tankSim?.netFlow ?? null;
  const level = tankSim?.level ?? null;
  const volume = tankSim?.volume ?? null;

  if (pressure !== null) {
    updateQuantityStats(statsMap, "pressure", pressure, units, formatting, id);
  }
  if (head !== null) {
    updateQuantityStats(statsMap, "head", head, units, formatting, id);
  }
  if (netFlow !== null) {
    updateQuantityStats(statsMap, "netFlow", netFlow, units, formatting, id);
  }
  if (level !== null) {
    updateQuantityStats(statsMap, "level", level, units, formatting, id);
  }
  if (volume !== null) {
    updateQuantityStats(statsMap, "volume", volume, units, formatting, id);
  }
};

const buildTankSections = (
  statsMap: Map<string, AssetPropertyStats>,
): AssetPropertySections => {
  // Remove volumeCurve row if no tanks actually have curves
  const curveStats = statsMap.get("volumeCurve") as
    | LiteralCategoryStats
    | undefined;
  if (curveStats && curveStats.values.size === 1 && curveStats.values.has("")) {
    statsMap.delete("volumeCurve");
  }

  return {
    activeTopology: getStatsForProperties(statsMap, ["isEnabled"]),
    modelAttributes: getStatsForProperties(statsMap, [
      "elevation",
      "initialLevel",
      "maxVolume",
      "volumeCurve",
      "minLevel",
      "maxLevel",
      "diameter",
      "minVolume",
      "canOverflow",
    ]),
    demands: [],
    energyResults: [],
    simulationResults: getStatsForProperties(statsMap, [
      "pressure",
      "head",
      "netFlow",
      "level",
      "volume",
    ]),
  };
};

const updateQuantityStats = (
  statsMap: Map<string, AssetPropertyStats>,
  property: string,
  value: number | null,
  units: UnitsSpec,
  formatting: FormattingSpec,
  assetId: AssetId,
  overrides?: { unit?: Unit; decimals?: number },
) => {
  if (value === null) return;

  if (!statsMap.has(property)) {
    const decimals =
      overrides?.decimals ??
      getDecimals(formatting, property as keyof UnitsSpec) ??
      3;
    const unit =
      overrides?.unit !== undefined
        ? overrides.unit
        : units[property as keyof UnitsSpec];

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
  const ids = stats.values.get(roundedValue) || [];
  ids.push(assetId);
  stats.values.set(roundedValue, ids);

  const mean = stats.sum / stats.times;
  stats.mean = roundToDecimal(mean, stats.decimals);
};

const updateCustomerCountStats = (
  statsMap: Map<string, AssetPropertyStats>,
  property: string,
  value: number,
  assetId: AssetId,
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
  const ids = stats.values.get(value) || [];
  ids.push(assetId);
  stats.values.set(value, ids);

  const mean = stats.sum / stats.times;
  stats.mean = roundToDecimal(mean, 0);
};

const updateCategoryStats = (
  statsMap: Map<string, AssetPropertyStats>,
  property: string,
  value: string,
  assetId: AssetId,
) => {
  if (!statsMap.has(property)) {
    statsMap.set(property, {
      type: "category",
      property,
      values: new Map(),
    });
  }

  const stats = statsMap.get(property) as CategoryStats;
  const ids = stats.values.get(value) || [];
  ids.push(assetId);
  stats.values.set(value, ids);
};

const updateLinkStats = (
  statsMap: Map<string, AssetPropertyStats>,
  property: string,
  linkLabel: string,
  assetId: AssetId,
) => {
  if (!statsMap.has(property)) {
    statsMap.set(property, {
      type: "literalCategory",
      property,
      values: new Map(),
    });
  }

  const stats = statsMap.get(property) as LiteralCategoryStats;
  const ids = stats.values.get(linkLabel) || [];
  ids.push(assetId);
  stats.values.set(linkLabel, ids);
};

const updateBooleanStats = (
  statsMap: Map<string, AssetPropertyStats>,
  property: string,
  value: boolean,
  assetId: AssetId,
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
  const ids = stats.values.get(label) || [];
  ids.push(assetId);
  stats.values.set(label, ids);
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
