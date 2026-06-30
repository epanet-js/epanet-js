import { Unit } from "@epanet-js/quantity";
import {
  UnitsSpec,
  FormattingSpec,
} from "src/lib/project-settings/quantities-spec";
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
import {
  Valve,
  Curves,
  CustomerPointsLookup,
  CustomerPoint,
  getActiveCustomerPoints,
  tankVolumeCurveRange,
  DEFAULT_MINOR_LOSS,
  DEFAULT_EMITTER_COEFFICIENT,
  DEFAULT_MIN_VOLUME,
  DEFAULT_MIXING_FRACTION,
  DEFAULT_SPEED,
  DEFAULT_INITIAL_QUALITY,
} from "@epanet-js/hydraulic-model";
import {
  Patterns,
  Demands,
  calculateAverageDemand,
  calculateAverageHead,
  getCustomerPointDemands,
  getJunctionDemands,
} from "src/hydraulic-model";

import {
  type PropertyStats,
  type QuantityStats,
  type LiteralCategoryStats,
  roundToDecimal,
  updateBooleanStats,
  updateCategoryStats,
  updateLinkStats,
  updateQuantityStats,
} from "./stats";

type Section =
  | "activeTopology"
  | "modelAttributes"
  | "quality"
  | "energy"
  | "simulationResults"
  | "demands"
  | "energyResults";

export type AssetPropertySections = {
  [section in Section]: PropertyStats[];
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

export const computeAssetsStats = (
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
    junction: new Map<string, PropertyStats>(),
    pipe: new Map<string, PropertyStats>(),
    pump: new Map<string, PropertyStats>(),
    valve: new Map<string, PropertyStats>(),
    reservoir: new Map<string, PropertyStats>(),
    tank: new Map<string, PropertyStats>(),
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
          hydraulicModel.patterns,
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
          hydraulicModel.patterns,
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
  statsMap: Map<string, PropertyStats>,
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
    junction.emitterCoefficient ?? DEFAULT_EMITTER_COEFFICIENT,
    units,
    formatting,
    id,
  );
  updateQuantityStats(
    statsMap,
    "initialQuality",
    junction.initialQuality ?? DEFAULT_INITIAL_QUALITY,
    units,
    formatting,
    id,
  );
  updateCategoryStats(
    statsMap,
    "chemicalSourceType",
    junction.chemicalSourceType
      ? "source." + junction.chemicalSourceType
      : undefined,
    id,
    "none",
  );
  if (junction.chemicalSourceType) {
    updateQuantityStats(
      statsMap,
      "chemicalSourceStrength",
      junction.chemicalSourceStrength,
      units,
      formatting,
      id,
      { emptyLabel: "none" },
    );
    const junctionPattern =
      junction.chemicalSourcePatternId !== undefined
        ? patterns.get(junction.chemicalSourcePatternId)
        : undefined;
    updateLinkStats(
      statsMap,
      "chemicalSourcePattern",
      junctionPattern?.label,
      id,
      "none",
    );
  }

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
  const waterAge = junctionSim?.waterAge ?? null;
  if (waterAge !== null) {
    updateQuantityStats(statsMap, "waterAge", waterAge, units, formatting, id);
  }
  const waterTrace = junctionSim?.waterTrace ?? null;
  if (waterTrace !== null) {
    updateQuantityStats(
      statsMap,
      "waterTrace",
      waterTrace,
      units,
      formatting,
      id,
    );
  }
  const chemicalConcentration = junctionSim?.chemicalConcentration ?? null;
  if (chemicalConcentration !== null) {
    updateQuantityStats(
      statsMap,
      "chemicalConcentration",
      chemicalConcentration,
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
  statsMap: Map<string, PropertyStats>,
): AssetPropertySections => {
  return {
    activeTopology: getStatsForProperties(statsMap, ["isEnabled"]),
    modelAttributes: getStatsForProperties(statsMap, [
      "elevation",
      "emitterCoefficient",
    ]),
    quality: getStatsForProperties(statsMap, [
      "initialQuality",
      "chemicalSourceType",
      "chemicalSourceStrength",
      "chemicalSourcePattern",
    ]),
    energy: [],
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
      "waterAge",
      "waterTrace",
      "chemicalConcentration",
    ]),
  };
};

const appendPipeStats = (
  statsMap: Map<string, PropertyStats>,
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
  updateCategoryStats(statsMap, "material", pipe.material, id, "none");
  updateQuantityStats(statsMap, "year", pipe.year, units, formatting, id, {
    unit: null,
    decimals: 0,
    isInteger: true,
    emptyLabel: "none",
  });
  updateQuantityStats(
    statsMap,
    "roughness",
    pipe.roughness,
    units,
    formatting,
    id,
    { emptyLabel: "none" },
  );
  updateQuantityStats(
    statsMap,
    "minorLoss",
    pipe.minorLoss ?? DEFAULT_MINOR_LOSS,
    units,
    formatting,
    id,
  );
  updateQuantityStats(
    statsMap,
    "bulkReactionCoeff",
    pipe.bulkReactionCoeff,
    units,
    formatting,
    id,
    { emptyLabel: "globalDefault" },
  );
  updateQuantityStats(
    statsMap,
    "wallReactionCoeff",
    pipe.wallReactionCoeff,
    units,
    formatting,
    id,
    { emptyLabel: "globalDefault" },
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
  const waterAge = pipeSim?.waterAge ?? null;
  if (waterAge !== null) {
    updateQuantityStats(statsMap, "waterAge", waterAge, units, formatting, id);
  }
  const waterTrace = pipeSim?.waterTrace ?? null;
  if (waterTrace !== null) {
    updateQuantityStats(
      statsMap,
      "waterTrace",
      waterTrace,
      units,
      formatting,
      id,
    );
  }
  const chemicalConcentration = pipeSim?.chemicalConcentration ?? null;
  if (chemicalConcentration !== null) {
    updateQuantityStats(
      statsMap,
      "chemicalConcentration",
      chemicalConcentration,
      units,
      formatting,
      id,
    );
  }
};

const buildPipeSections = (
  statsMap: Map<string, PropertyStats>,
): AssetPropertySections => {
  return {
    activeTopology: getStatsForProperties(statsMap, ["isEnabled"]),
    modelAttributes: getStatsForProperties(statsMap, [
      "initialStatus",
      "diameter",
      "length",
      "roughness",
      "minorLoss",
      "material",
      "year",
    ]),
    quality: getStatsForProperties(statsMap, [
      "bulkReactionCoeff",
      "wallReactionCoeff",
    ]),
    energy: [],
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
      "waterAge",
      "waterTrace",
      "chemicalConcentration",
    ]),
  };
};

const appendPumpStats = (
  statsMap: Map<string, PropertyStats>,
  pump: Pump,
  units: UnitsSpec,
  formatting: FormattingSpec,
  curves: Curves,
  patterns: Patterns,
  simulationResults?: ResultsReader | null,
) => {
  const id = pump.id;
  updateBooleanStats(statsMap, "isEnabled", pump.isActive, id);

  const pumpType: string =
    pump.definitionType === "curveId" ? "namedCurve" : pump.definitionType;
  updateCategoryStats(statsMap, "pumpType", pumpType, id);

  const pumpCurve =
    pump.definitionType === "curveId" && pump.curveId
      ? curves.get(pump.curveId)
      : undefined;
  updateLinkStats(statsMap, "pumpName", pumpCurve?.label, id, "none");

  updateCategoryStats(
    statsMap,
    "initialStatus",
    "pump." + pump.initialStatus,
    id,
  );

  updateQuantityStats(
    statsMap,
    "speed",
    pump.speed ?? DEFAULT_SPEED,
    units,
    formatting,
    id,
  );
  const speedPattern =
    pump.speedPatternId !== undefined
      ? patterns.get(pump.speedPatternId)
      : undefined;
  updateLinkStats(
    statsMap,
    "speedPattern",
    speedPattern?.label,
    id,
    "constant",
  );

  // Energy settings
  const efficiencyCurve = pump.efficiencyCurveId
    ? curves.get(pump.efficiencyCurveId)
    : undefined;
  updateLinkStats(
    statsMap,
    "efficiencyCurve",
    efficiencyCurve?.label,
    id,
    "none",
  );

  updateQuantityStats(
    statsMap,
    "energyPrice",
    pump.energyPrice,
    units,
    formatting,
    id,
    { decimals: 4, unit: null as Unit, emptyLabel: "globalDefault" },
  );

  const energyPattern = pump.energyPricePatternId
    ? patterns.get(pump.energyPricePatternId)
    : undefined;
  updateLinkStats(
    statsMap,
    "energyPricePattern",
    energyPattern?.label,
    id,
    "constant",
  );

  // Simulation results - read from ResultsReader
  const pumpSim = simulationResults?.getPump(pump.id);
  const flow = pumpSim?.flow ?? null;
  const head = pumpSim?.head ?? null;
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
  const waterAge = pumpSim?.waterAge ?? null;
  if (waterAge !== null) {
    updateQuantityStats(statsMap, "waterAge", waterAge, units, formatting, id);
  }
  const waterTrace = pumpSim?.waterTrace ?? null;
  if (waterTrace !== null) {
    updateQuantityStats(
      statsMap,
      "waterTrace",
      waterTrace,
      units,
      formatting,
      id,
    );
  }
  const chemicalConcentration = pumpSim?.chemicalConcentration ?? null;
  if (chemicalConcentration !== null) {
    updateQuantityStats(
      statsMap,
      "chemicalConcentration",
      chemicalConcentration,
      units,
      formatting,
      id,
    );
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
  statsMap: Map<string, PropertyStats>,
): AssetPropertySections => {
  // Remove pumpName row if no pumps have named curves
  const pumpNameStats = statsMap.get("pumpName") as
    | LiteralCategoryStats
    | undefined;
  if (
    pumpNameStats &&
    pumpNameStats.values.size === 0 &&
    !!pumpNameStats.emptyBucket
  ) {
    statsMap.delete("pumpName");
  }

  // Keep all energy fields if any pump has a non-empty value;
  // remove them all if every pump is unset across all three fields
  const hasAnyEnergy = [
    "efficiencyCurve",
    "energyPricePattern",
    "energyPrice",
  ].some((key) => {
    const stats = statsMap.get(key);
    return !!stats && stats.values.size > 0;
  });

  if (!hasAnyEnergy) {
    statsMap.delete("efficiencyCurve");
    statsMap.delete("energyPricePattern");
    statsMap.delete("energyPrice");
  }

  return {
    activeTopology: getStatsForProperties(statsMap, ["isEnabled"]),
    modelAttributes: getStatsForProperties(statsMap, [
      "pumpType",
      "pumpName",
      "initialStatus",
      "speed",
      "speedPattern",
    ]),
    quality: [],
    energy: getStatsForProperties(statsMap, [
      "efficiencyCurve",
      "energyPrice",
      "energyPricePattern",
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
      "waterAge",
      "waterTrace",
      "chemicalConcentration",
    ]),
  };
};

const appendValveStats = (
  statsMap: Map<string, PropertyStats>,
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
    { emptyLabel: "none" },
  );
  updateQuantityStats(
    statsMap,
    "diameter",
    valve.diameter,
    units,
    formatting,
    id,
    { emptyLabel: "none" },
  );
  updateQuantityStats(
    statsMap,
    "minorLoss",
    valve.minorLoss ?? DEFAULT_MINOR_LOSS,
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
  const waterAge = valveSim?.waterAge ?? null;
  if (waterAge !== null) {
    updateQuantityStats(statsMap, "waterAge", waterAge, units, formatting, id);
  }
  const waterTrace = valveSim?.waterTrace ?? null;
  if (waterTrace !== null) {
    updateQuantityStats(
      statsMap,
      "waterTrace",
      waterTrace,
      units,
      formatting,
      id,
    );
  }
  const chemicalConcentration = valveSim?.chemicalConcentration ?? null;
  if (chemicalConcentration !== null) {
    updateQuantityStats(
      statsMap,
      "chemicalConcentration",
      chemicalConcentration,
      units,
      formatting,
      id,
    );
  }
};

const buildValveSections = (
  statsMap: Map<string, PropertyStats>,
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
    quality: [],
    energy: [],
    demands: [],
    energyResults: [],
    simulationResults: getStatsForProperties(statsMap, [
      "flow",
      "velocity",
      "headloss",
      "valveStatus",
      "waterAge",
      "waterTrace",
      "chemicalConcentration",
    ]),
  };
};

const appendReservoirStats = (
  statsMap: Map<string, PropertyStats>,
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

  updateQuantityStats(
    statsMap,
    "initialQuality",
    reservoir.initialQuality ?? DEFAULT_INITIAL_QUALITY,
    units,
    formatting,
    id,
  );
  updateCategoryStats(
    statsMap,
    "chemicalSourceType",
    reservoir.chemicalSourceType
      ? "source." + reservoir.chemicalSourceType
      : undefined,
    id,
    "none",
  );
  if (reservoir.chemicalSourceType) {
    updateQuantityStats(
      statsMap,
      "chemicalSourceStrength",
      reservoir.chemicalSourceStrength,
      units,
      formatting,
      id,
      { emptyLabel: "none" },
    );
    const reservoirPattern =
      reservoir.chemicalSourcePatternId !== undefined
        ? patterns.get(reservoir.chemicalSourcePatternId)
        : undefined;
    updateLinkStats(
      statsMap,
      "chemicalSourcePattern",
      reservoirPattern?.label,
      id,
      "none",
    );
  }

  const averageHead = calculateAverageHead(reservoir, patterns);
  updateQuantityStats(statsMap, "head", averageHead, units, formatting, id);
  const reservoirHeadPattern =
    reservoir.headPatternId !== undefined
      ? patterns.get(reservoir.headPatternId)
      : undefined;
  updateLinkStats(
    statsMap,
    "headPattern",
    reservoirHeadPattern?.label,
    id,
    "constant",
  );

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
  const waterAge = reservoirSim?.waterAge ?? null;
  if (waterAge !== null) {
    updateQuantityStats(statsMap, "waterAge", waterAge, units, formatting, id);
  }
  const waterTrace = reservoirSim?.waterTrace ?? null;
  if (waterTrace !== null) {
    updateQuantityStats(
      statsMap,
      "waterTrace",
      waterTrace,
      units,
      formatting,
      id,
    );
  }
  const chemicalConcentration = reservoirSim?.chemicalConcentration ?? null;
  if (chemicalConcentration !== null) {
    updateQuantityStats(
      statsMap,
      "chemicalConcentration",
      chemicalConcentration,
      units,
      formatting,
      id,
    );
  }
};

const buildReservoirSections = (
  statsMap: Map<string, PropertyStats>,
): AssetPropertySections => {
  return {
    activeTopology: getStatsForProperties(statsMap, ["isEnabled"]),
    modelAttributes: getStatsForProperties(statsMap, [
      "elevation",
      "head",
      "headPattern",
    ]),
    quality: getStatsForProperties(statsMap, [
      "initialQuality",
      "chemicalSourceType",
      "chemicalSourceStrength",
      "chemicalSourcePattern",
    ]),
    energy: [],
    demands: [],
    energyResults: [],
    simulationResults: getStatsForProperties(statsMap, [
      "pressure",
      "actualHead",
      "netFlow",
      "waterAge",
      "waterTrace",
      "chemicalConcentration",
    ]),
  };
};

const appendTankStats = (
  statsMap: Map<string, PropertyStats>,
  tank: Tank,
  units: UnitsSpec,
  formatting: FormattingSpec,
  curves: Curves,
  patterns: Patterns,
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
    { emptyLabel: "none" },
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
      { emptyLabel: "none" },
    );
    updateQuantityStats(
      statsMap,
      "minVolume",
      tank.minVolume ?? DEFAULT_MIN_VOLUME,
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
    updateLinkStats(statsMap, "volumeCurve", null, id, "none");
  } else {
    const curve = curves.get(tank.volumeCurveId);
    if (curve) {
      updateLinkStats(statsMap, "volumeCurve", curve.label, id, "none");
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

  updateQuantityStats(
    statsMap,
    "initialQuality",
    tank.initialQuality ?? DEFAULT_INITIAL_QUALITY,
    units,
    formatting,
    id,
  );
  updateQuantityStats(
    statsMap,
    "bulkReactionCoeff",
    tank.bulkReactionCoeff,
    units,
    formatting,
    id,
    { emptyLabel: "globalDefault" },
  );
  updateCategoryStats(
    statsMap,
    "chemicalSourceType",
    tank.chemicalSourceType ? "source." + tank.chemicalSourceType : undefined,
    id,
    "none",
  );
  if (tank.chemicalSourceType) {
    updateQuantityStats(
      statsMap,
      "chemicalSourceStrength",
      tank.chemicalSourceStrength,
      units,
      formatting,
      id,
      { emptyLabel: "none" },
    );
    const tankPattern =
      tank.chemicalSourcePatternId !== undefined
        ? patterns.get(tank.chemicalSourcePatternId)
        : undefined;
    updateLinkStats(
      statsMap,
      "chemicalSourcePattern",
      tankPattern?.label,
      id,
      "none",
    );
  }

  const mixingLabel = "tank." + tank.mixingModel;
  updateCategoryStats(statsMap, "mixingModel", mixingLabel, id);
  updateQuantityStats(
    statsMap,
    "mixingFraction",
    tank.mixingFraction ?? DEFAULT_MIXING_FRACTION,
    units,
    formatting,
    id,
  );

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
  const waterAge = tankSim?.waterAge ?? null;
  if (waterAge !== null) {
    updateQuantityStats(statsMap, "waterAge", waterAge, units, formatting, id);
  }
  const waterTrace = tankSim?.waterTrace ?? null;
  if (waterTrace !== null) {
    updateQuantityStats(
      statsMap,
      "waterTrace",
      waterTrace,
      units,
      formatting,
      id,
    );
  }
  const chemicalConcentration = tankSim?.chemicalConcentration ?? null;
  if (chemicalConcentration !== null) {
    updateQuantityStats(
      statsMap,
      "chemicalConcentration",
      chemicalConcentration,
      units,
      formatting,
      id,
    );
  }
};

const buildTankSections = (
  statsMap: Map<string, PropertyStats>,
): AssetPropertySections => {
  // Remove volumeCurve row if no tanks actually have curves
  const curveStats = statsMap.get("volumeCurve") as
    | LiteralCategoryStats
    | undefined;
  if (curveStats && curveStats.values.size === 0 && !!curveStats.emptyBucket) {
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
    quality: getStatsForProperties(statsMap, [
      "initialQuality",
      "mixingModel",
      "mixingFraction",
      "bulkReactionCoeff",
      "chemicalSourceType",
      "chemicalSourceStrength",
      "chemicalSourcePattern",
    ]),
    energy: [],
    demands: [],
    energyResults: [],
    simulationResults: getStatsForProperties(statsMap, [
      "pressure",
      "head",
      "netFlow",
      "level",
      "volume",
      "waterAge",
      "waterTrace",
      "chemicalConcentration",
    ]),
  };
};

const updateCustomerCountStats = (
  statsMap: Map<string, PropertyStats>,
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

const getStatsForProperties = (
  statsMap: Map<string, PropertyStats>,
  properties: string[],
): PropertyStats[] => {
  const result: PropertyStats[] = [];

  for (const property of properties) {
    const stats = statsMap.get(property);
    if (stats) {
      result.push(stats);
    }
  }

  return result;
};
