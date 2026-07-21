import { Unit } from "@epanet-js/quantity";
import {
  UnitsSpec,
  FormattingSpec,
} from "src/lib/project-settings/quantities-spec";
import type { ResultsReader } from "src/simulation/results-reader";
import type { SimulationSettings } from "src/simulation/simulation-settings";
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
  type PropertyStatsDeprecated,
  type QuantityStatsDeprecated,
  type LiteralCategoryStatsDeprecated,
  roundToDecimalDeprecated,
  updateBooleanStatsDeprecated,
  updateCategoryStatsDeprecated,
  updateLinkStatsDeprecated,
  updateQuantityStatsDeprecated,
} from "./stats-deprecated";

type SectionDeprecated =
  | "activeTopology"
  | "modelAttributes"
  | "quality"
  | "energy"
  | "simulationResults"
  | "demands"
  | "energyResults";

export type AssetPropertySectionsDeprecated = {
  [section in SectionDeprecated]: PropertyStatsDeprecated[];
};

export type MultiAssetsDataDeprecated = {
  [type in Asset["type"]]: AssetPropertySectionsDeprecated;
};

export type AssetCountsDeprecated = {
  [type in Asset["type"]]: number;
};

export type ComputedMultiAssetDataDeprecated = {
  data: MultiAssetsDataDeprecated;
  counts: AssetCountsDeprecated;
};

export const computeAssetsStatsDeprecated = (
  assets: Asset[],
  units: UnitsSpec,
  formatting: FormattingSpec,
  hydraulicModel: HydraulicModel,
  simulationSettings: SimulationSettings,
  simulationResults: ResultsReader | null,
): ComputedMultiAssetDataDeprecated => {
  const counts: AssetCountsDeprecated = {
    junction: 0,
    pipe: 0,
    pump: 0,
    valve: 0,
    reservoir: 0,
    tank: 0,
  };

  const statsMaps = {
    junction: new Map<string, PropertyStatsDeprecated>(),
    pipe: new Map<string, PropertyStatsDeprecated>(),
    pump: new Map<string, PropertyStatsDeprecated>(),
    valve: new Map<string, PropertyStatsDeprecated>(),
    reservoir: new Map<string, PropertyStatsDeprecated>(),
    tank: new Map<string, PropertyStatsDeprecated>(),
  };

  for (const asset of assets) {
    switch (asset.type) {
      case "junction":
        counts.junction++;
        appendJunctionStatsDeprecated(
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
        appendPipeStatsDeprecated(
          statsMaps.pipe,
          asset as Pipe,
          units,
          formatting,
          hydraulicModel.customerPointsLookup,
          hydraulicModel.demands,
          hydraulicModel.patterns,
          simulationSettings,
          simulationResults,
        );
        break;
      case "pump":
        counts.pump++;
        appendPumpStatsDeprecated(
          statsMaps.pump,
          asset as Pump,
          units,
          formatting,
          hydraulicModel.curves,
          hydraulicModel.patterns,
          simulationSettings,
          simulationResults,
        );
        break;
      case "valve":
        counts.valve++;
        appendValveStatsDeprecated(
          statsMaps.valve,
          asset as Valve,
          units,
          formatting,
          simulationResults,
        );
        break;
      case "reservoir":
        counts.reservoir++;
        appendReservoirStatsDeprecated(
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
        appendTankStatsDeprecated(
          statsMaps.tank,
          asset as Tank,
          units,
          formatting,
          hydraulicModel.curves,
          hydraulicModel.patterns,
          simulationSettings,
          simulationResults,
        );
        break;
    }
  }

  return {
    data: {
      junction: buildJunctionSectionsDeprecated(statsMaps.junction),
      pipe: buildPipeSectionsDeprecated(statsMaps.pipe),
      pump: buildPumpSectionsDeprecated(statsMaps.pump),
      valve: buildValveSectionsDeprecated(statsMaps.valve),
      reservoir: buildReservoirSectionsDeprecated(statsMaps.reservoir),
      tank: buildTankSectionsDeprecated(statsMaps.tank),
    },
    counts,
  };
};

const appendJunctionStatsDeprecated = (
  statsMap: Map<string, PropertyStatsDeprecated>,
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
  updateBooleanStatsDeprecated(statsMap, "isEnabled", junction.isActive, id);
  updateQuantityStatsDeprecated(
    statsMap,
    "elevation",
    junction.elevation,
    units,
    formatting,
    id,
  );
  updateQuantityStatsDeprecated(
    statsMap,
    "emitterCoefficient",
    junction.emitterCoefficient ?? DEFAULT_EMITTER_COEFFICIENT,
    units,
    formatting,
    id,
  );
  updateQuantityStatsDeprecated(
    statsMap,
    "initialQuality",
    junction.initialQuality ?? DEFAULT_INITIAL_QUALITY,
    units,
    formatting,
    id,
  );
  updateCategoryStatsDeprecated(
    statsMap,
    "chemicalSourceType",
    junction.chemicalSourceType
      ? "source." + junction.chemicalSourceType
      : undefined,
    id,
    "none",
  );
  if (junction.chemicalSourceType) {
    updateQuantityStatsDeprecated(
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
    updateLinkStatsDeprecated(
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
  updateQuantityStatsDeprecated(
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
    const totalCustomerDemand = calculateCustomerPointsDemandDeprecated(
      customerPoints,
      demands,
      patterns,
    );

    updateQuantityStatsDeprecated(
      statsMap,
      "customerDemand",
      totalCustomerDemand,
      units,
      formatting,
      id,
    );

    updateCustomerCountStatsDeprecated(
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
    updateQuantityStatsDeprecated(
      statsMap,
      "pressure",
      pressure,
      units,
      formatting,
      id,
    );
  }
  if (head !== null) {
    updateQuantityStatsDeprecated(
      statsMap,
      "head",
      head,
      units,
      formatting,
      id,
    );
  }
  if (actualDemand !== null) {
    updateQuantityStatsDeprecated(
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
    updateQuantityStatsDeprecated(
      statsMap,
      "waterAge",
      waterAge,
      units,
      formatting,
      id,
    );
  }
  const waterTrace = junctionSim?.waterTrace ?? null;
  if (waterTrace !== null) {
    updateQuantityStatsDeprecated(
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
    updateQuantityStatsDeprecated(
      statsMap,
      "chemicalConcentration",
      chemicalConcentration,
      units,
      formatting,
      id,
    );
  }
};

const calculateCustomerPointsDemandDeprecated = (
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

const buildJunctionSectionsDeprecated = (
  statsMap: Map<string, PropertyStatsDeprecated>,
): AssetPropertySectionsDeprecated => {
  return {
    activeTopology: getStatsForPropertiesDeprecated(statsMap, ["isEnabled"]),
    modelAttributes: getStatsForPropertiesDeprecated(statsMap, [
      "elevation",
      "emitterCoefficient",
    ]),
    quality: getStatsForPropertiesDeprecated(statsMap, [
      "initialQuality",
      "chemicalSourceType",
      "chemicalSourceStrength",
      "chemicalSourcePattern",
    ]),
    energy: [],
    demands: getStatsForPropertiesDeprecated(statsMap, [
      "directDemand",
      "customerDemand",
      "connectedCustomers",
    ]),
    energyResults: [],
    simulationResults: getStatsForPropertiesDeprecated(statsMap, [
      "pressure",
      "head",
      "actualDemand",
      "waterAge",
      "waterTrace",
      "chemicalConcentration",
    ]),
  };
};

const appendPipeStatsDeprecated = (
  statsMap: Map<string, PropertyStatsDeprecated>,
  pipe: Pipe,
  units: UnitsSpec,
  formatting: FormattingSpec,
  customerPointsLookup: CustomerPointsLookup,
  demands: Demands,
  patterns: Patterns,
  simulationSettings: SimulationSettings,
  simulationResults?: ResultsReader | null,
) => {
  const id = pipe.id;
  updateBooleanStatsDeprecated(statsMap, "isEnabled", pipe.isActive, id);
  updateCategoryStatsDeprecated(
    statsMap,
    "initialStatus",
    "pipe." + pipe.initialStatus,
    id,
  );
  updateQuantityStatsDeprecated(
    statsMap,
    "diameter",
    pipe.diameter,
    units,
    formatting,
    id,
    { emptyLabel: "none" },
  );
  updateQuantityStatsDeprecated(
    statsMap,
    "length",
    pipe.length,
    units,
    formatting,
    id,
    { emptyLabel: "none" },
  );
  updateCategoryStatsDeprecated(
    statsMap,
    "material",
    pipe.material,
    id,
    "none",
  );
  updateQuantityStatsDeprecated(
    statsMap,
    "year",
    pipe.year,
    units,
    formatting,
    id,
    {
      unit: null,
      decimals: 0,
      isInteger: true,
      emptyLabel: "none",
    },
  );
  updateQuantityStatsDeprecated(
    statsMap,
    "roughness",
    pipe.roughness,
    units,
    formatting,
    id,
    { emptyLabel: "none" },
  );
  updateQuantityStatsDeprecated(
    statsMap,
    "minorLoss",
    pipe.minorLoss ?? DEFAULT_MINOR_LOSS,
    units,
    formatting,
    id,
  );
  updateQuantityStatsDeprecated(
    statsMap,
    "bulkReactionCoeff",
    pipe.bulkReactionCoeff,
    units,
    formatting,
    id,
    {
      emptyLabel: "globalDefault",
      emptyValue: simulationSettings.reactionGlobalBulk,
    },
  );
  updateQuantityStatsDeprecated(
    statsMap,
    "wallReactionCoeff",
    pipe.wallReactionCoeff,
    units,
    formatting,
    id,
    {
      emptyLabel: "globalDefault",
      emptyValue: simulationSettings.reactionGlobalWall,
    },
  );

  const customerPoints = customerPointsLookup.getCustomerPoints(pipe.id);
  if (customerPoints.size > 0) {
    const totalCustomerDemand = calculateCustomerPointsDemandDeprecated(
      Array.from(customerPoints),
      demands,
      patterns,
    );

    updateQuantityStatsDeprecated(
      statsMap,
      "customerDemand",
      totalCustomerDemand,
      units,
      formatting,
      id,
    );

    updateCustomerCountStatsDeprecated(
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
    updateQuantityStatsDeprecated(
      statsMap,
      "flow",
      flow,
      units,
      formatting,
      id,
    );
  }
  if (velocity !== null) {
    updateQuantityStatsDeprecated(
      statsMap,
      "velocity",
      velocity,
      units,
      formatting,
      id,
    );
  }
  if (unitHeadloss !== null) {
    updateQuantityStatsDeprecated(
      statsMap,
      "unitHeadloss",
      unitHeadloss,
      units,
      formatting,
      id,
    );
  }
  if (headloss !== null) {
    updateQuantityStatsDeprecated(
      statsMap,
      "headloss",
      headloss,
      units,
      formatting,
      id,
    );
  }
  if (status !== null) {
    const statusLabel = "pipe." + status;
    updateCategoryStatsDeprecated(statsMap, "pipeStatus", statusLabel, id);
  }
  const waterAge = pipeSim?.waterAge ?? null;
  if (waterAge !== null) {
    updateQuantityStatsDeprecated(
      statsMap,
      "waterAge",
      waterAge,
      units,
      formatting,
      id,
    );
  }
  const waterTrace = pipeSim?.waterTrace ?? null;
  if (waterTrace !== null) {
    updateQuantityStatsDeprecated(
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
    updateQuantityStatsDeprecated(
      statsMap,
      "chemicalConcentration",
      chemicalConcentration,
      units,
      formatting,
      id,
    );
  }
};

const buildPipeSectionsDeprecated = (
  statsMap: Map<string, PropertyStatsDeprecated>,
): AssetPropertySectionsDeprecated => {
  return {
    activeTopology: getStatsForPropertiesDeprecated(statsMap, ["isEnabled"]),
    modelAttributes: getStatsForPropertiesDeprecated(statsMap, [
      "initialStatus",
      "diameter",
      "length",
      "roughness",
      "minorLoss",
      "material",
      "year",
    ]),
    quality: getStatsForPropertiesDeprecated(statsMap, [
      "bulkReactionCoeff",
      "wallReactionCoeff",
    ]),
    energy: [],
    demands: getStatsForPropertiesDeprecated(statsMap, [
      "customerDemand",
      "connectedCustomers",
    ]),
    energyResults: [],
    simulationResults: getStatsForPropertiesDeprecated(statsMap, [
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

const appendPumpStatsDeprecated = (
  statsMap: Map<string, PropertyStatsDeprecated>,
  pump: Pump,
  units: UnitsSpec,
  formatting: FormattingSpec,
  curves: Curves,
  patterns: Patterns,
  simulationSettings: SimulationSettings,
  simulationResults?: ResultsReader | null,
) => {
  const id = pump.id;
  updateBooleanStatsDeprecated(statsMap, "isEnabled", pump.isActive, id);

  const pumpType: string =
    pump.definitionType === "curveId" ? "namedCurve" : pump.definitionType;
  updateCategoryStatsDeprecated(statsMap, "pumpType", pumpType, id);

  const pumpCurve =
    pump.definitionType === "curveId" && pump.curveId
      ? curves.get(pump.curveId)
      : undefined;
  updateLinkStatsDeprecated(statsMap, "pumpName", pumpCurve?.label, id, "none");

  updateCategoryStatsDeprecated(
    statsMap,
    "initialStatus",
    "pump." + pump.initialStatus,
    id,
  );

  updateQuantityStatsDeprecated(
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
  updateLinkStatsDeprecated(
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
  updateLinkStatsDeprecated(
    statsMap,
    "efficiencyCurve",
    efficiencyCurve?.label,
    id,
    "none",
  );

  updateQuantityStatsDeprecated(
    statsMap,
    "energyPrice",
    pump.energyPrice,
    units,
    formatting,
    id,
    {
      decimals: 4,
      unit: null as Unit,
      emptyLabel: "globalDefault",
      emptyValue: simulationSettings.energyGlobalPrice,
    },
  );

  const energyPattern = pump.energyPricePatternId
    ? patterns.get(pump.energyPricePatternId)
    : undefined;
  updateLinkStatsDeprecated(
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
    updateQuantityStatsDeprecated(
      statsMap,
      "flow",
      flow,
      units,
      formatting,
      id,
    );
  }
  if (head !== null) {
    updateQuantityStatsDeprecated(
      statsMap,
      "pumpHead",
      head,
      units,
      formatting,
      id,
    );
  }
  if (status !== null) {
    const statusLabel = statusWarning
      ? `pump.${status}.${statusWarning}`
      : "pump." + status;
    updateCategoryStatsDeprecated(statsMap, "pumpStatus", statusLabel, id);
  }
  const waterAge = pumpSim?.waterAge ?? null;
  if (waterAge !== null) {
    updateQuantityStatsDeprecated(
      statsMap,
      "waterAge",
      waterAge,
      units,
      formatting,
      id,
    );
  }
  const waterTrace = pumpSim?.waterTrace ?? null;
  if (waterTrace !== null) {
    updateQuantityStatsDeprecated(
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
    updateQuantityStatsDeprecated(
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

    updateQuantityStatsDeprecated(
      statsMap,
      "utilization",
      energy.utilization,
      units,
      formatting,
      id,
      percentUnit,
    );
    updateQuantityStatsDeprecated(
      statsMap,
      "averageEfficiency",
      energy.averageEfficiency,
      units,
      formatting,
      id,
      percentUnit,
    );
    updateQuantityStatsDeprecated(
      statsMap,
      "averageKwPerFlowUnit",
      energy.averageKwPerFlowUnit,
      units,
      formatting,
      id,
      { decimals: 2 },
    );
    updateQuantityStatsDeprecated(
      statsMap,
      "averageKw",
      energy.averageKw,
      units,
      formatting,
      id,
      powerUnit,
    );
    updateQuantityStatsDeprecated(
      statsMap,
      "peakKw",
      energy.peakKw,
      units,
      formatting,
      id,
      powerUnit,
    );
    updateQuantityStatsDeprecated(
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

const buildPumpSectionsDeprecated = (
  statsMap: Map<string, PropertyStatsDeprecated>,
): AssetPropertySectionsDeprecated => {
  // Remove pumpName row if no pumps have named curves
  const pumpNameStats = statsMap.get("pumpName") as
    | LiteralCategoryStatsDeprecated
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
    activeTopology: getStatsForPropertiesDeprecated(statsMap, ["isEnabled"]),
    modelAttributes: getStatsForPropertiesDeprecated(statsMap, [
      "pumpType",
      "pumpName",
      "initialStatus",
      "speed",
      "speedPattern",
    ]),
    quality: [],
    energy: getStatsForPropertiesDeprecated(statsMap, [
      "efficiencyCurve",
      "energyPrice",
      "energyPricePattern",
    ]),
    demands: [],
    energyResults: getStatsForPropertiesDeprecated(statsMap, [
      "utilization",
      "averageEfficiency",
      "averageKwPerFlowUnit",
      "averageKw",
      "peakKw",
      "averageCostPerDay",
    ]),
    simulationResults: getStatsForPropertiesDeprecated(statsMap, [
      "flow",
      "pumpHead",
      "pumpStatus",
      "waterAge",
      "waterTrace",
      "chemicalConcentration",
    ]),
  };
};

const appendValveStatsDeprecated = (
  statsMap: Map<string, PropertyStatsDeprecated>,
  valve: Valve,
  units: UnitsSpec,
  formatting: FormattingSpec,
  simulationResults?: ResultsReader | null,
) => {
  const id = valve.id;
  updateBooleanStatsDeprecated(statsMap, "isEnabled", valve.isActive, id);
  updateCategoryStatsDeprecated(
    statsMap,
    "valveType",
    `valve.${valve.kind}`,
    id,
  );
  updateCategoryStatsDeprecated(
    statsMap,
    "initialStatus",
    "valve." + valve.initialStatus,
    id,
  );
  updateQuantityStatsDeprecated(
    statsMap,
    "setting",
    valve.setting,
    units,
    formatting,
    id,
    { emptyLabel: "none" },
  );
  updateQuantityStatsDeprecated(
    statsMap,
    "diameter",
    valve.diameter,
    units,
    formatting,
    id,
    { emptyLabel: "none" },
  );
  updateQuantityStatsDeprecated(
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
    updateQuantityStatsDeprecated(
      statsMap,
      "flow",
      flow,
      units,
      formatting,
      id,
    );
  }
  if (velocity !== null) {
    updateQuantityStatsDeprecated(
      statsMap,
      "velocity",
      velocity,
      units,
      formatting,
      id,
    );
  }
  if (headloss !== null) {
    updateQuantityStatsDeprecated(
      statsMap,
      "headloss",
      headloss,
      units,
      formatting,
      id,
    );
  }
  if (status !== null) {
    const statusLabel = `valve.${status}`;
    updateCategoryStatsDeprecated(statsMap, "valveStatus", statusLabel, id);
  }
  const waterAge = valveSim?.waterAge ?? null;
  if (waterAge !== null) {
    updateQuantityStatsDeprecated(
      statsMap,
      "waterAge",
      waterAge,
      units,
      formatting,
      id,
    );
  }
  const waterTrace = valveSim?.waterTrace ?? null;
  if (waterTrace !== null) {
    updateQuantityStatsDeprecated(
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
    updateQuantityStatsDeprecated(
      statsMap,
      "chemicalConcentration",
      chemicalConcentration,
      units,
      formatting,
      id,
    );
  }
};

const buildValveSectionsDeprecated = (
  statsMap: Map<string, PropertyStatsDeprecated>,
): AssetPropertySectionsDeprecated => {
  return {
    activeTopology: getStatsForPropertiesDeprecated(statsMap, ["isEnabled"]),
    modelAttributes: getStatsForPropertiesDeprecated(statsMap, [
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
    simulationResults: getStatsForPropertiesDeprecated(statsMap, [
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

const appendReservoirStatsDeprecated = (
  statsMap: Map<string, PropertyStatsDeprecated>,
  reservoir: Reservoir,
  units: UnitsSpec,
  formatting: FormattingSpec,
  patterns: Patterns,
  simulationResults?: ResultsReader | null,
) => {
  const id = reservoir.id;
  updateBooleanStatsDeprecated(statsMap, "isEnabled", reservoir.isActive, id);
  updateQuantityStatsDeprecated(
    statsMap,
    "elevation",
    reservoir.elevation,
    units,
    formatting,
    id,
  );

  updateQuantityStatsDeprecated(
    statsMap,
    "initialQuality",
    reservoir.initialQuality ?? DEFAULT_INITIAL_QUALITY,
    units,
    formatting,
    id,
  );
  updateCategoryStatsDeprecated(
    statsMap,
    "chemicalSourceType",
    reservoir.chemicalSourceType
      ? "source." + reservoir.chemicalSourceType
      : undefined,
    id,
    "none",
  );
  if (reservoir.chemicalSourceType) {
    updateQuantityStatsDeprecated(
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
    updateLinkStatsDeprecated(
      statsMap,
      "chemicalSourcePattern",
      reservoirPattern?.label,
      id,
      "none",
    );
  }

  const averageHead = calculateAverageHead(reservoir, patterns);
  updateQuantityStatsDeprecated(
    statsMap,
    "head",
    averageHead,
    units,
    formatting,
    id,
  );
  const reservoirHeadPattern =
    reservoir.headPatternId !== undefined
      ? patterns.get(reservoir.headPatternId)
      : undefined;
  updateLinkStatsDeprecated(
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
    updateQuantityStatsDeprecated(
      statsMap,
      "pressure",
      pressure,
      units,
      formatting,
      id,
    );
  }
  if (simHead !== null) {
    updateQuantityStatsDeprecated(
      statsMap,
      "actualHead",
      simHead,
      units,
      formatting,
      id,
    );
  }
  if (netFlow !== null) {
    updateQuantityStatsDeprecated(
      statsMap,
      "netFlow",
      netFlow,
      units,
      formatting,
      id,
    );
  }
  const waterAge = reservoirSim?.waterAge ?? null;
  if (waterAge !== null) {
    updateQuantityStatsDeprecated(
      statsMap,
      "waterAge",
      waterAge,
      units,
      formatting,
      id,
    );
  }
  const waterTrace = reservoirSim?.waterTrace ?? null;
  if (waterTrace !== null) {
    updateQuantityStatsDeprecated(
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
    updateQuantityStatsDeprecated(
      statsMap,
      "chemicalConcentration",
      chemicalConcentration,
      units,
      formatting,
      id,
    );
  }
};

const buildReservoirSectionsDeprecated = (
  statsMap: Map<string, PropertyStatsDeprecated>,
): AssetPropertySectionsDeprecated => {
  return {
    activeTopology: getStatsForPropertiesDeprecated(statsMap, ["isEnabled"]),
    modelAttributes: getStatsForPropertiesDeprecated(statsMap, [
      "elevation",
      "head",
      "headPattern",
    ]),
    quality: getStatsForPropertiesDeprecated(statsMap, [
      "initialQuality",
      "chemicalSourceType",
      "chemicalSourceStrength",
      "chemicalSourcePattern",
    ]),
    energy: [],
    demands: [],
    energyResults: [],
    simulationResults: getStatsForPropertiesDeprecated(statsMap, [
      "pressure",
      "actualHead",
      "netFlow",
      "waterAge",
      "waterTrace",
      "chemicalConcentration",
    ]),
  };
};

const appendTankStatsDeprecated = (
  statsMap: Map<string, PropertyStatsDeprecated>,
  tank: Tank,
  units: UnitsSpec,
  formatting: FormattingSpec,
  curves: Curves,
  patterns: Patterns,
  simulationSettings: SimulationSettings,
  simulationResults?: ResultsReader | null,
) => {
  const id = tank.id;
  updateBooleanStatsDeprecated(statsMap, "isEnabled", tank.isActive, id);
  updateQuantityStatsDeprecated(
    statsMap,
    "elevation",
    tank.elevation,
    units,
    formatting,
    id,
  );
  updateQuantityStatsDeprecated(
    statsMap,
    "initialLevel",
    tank.initialLevel,
    units,
    formatting,
    id,
    { emptyLabel: "none" },
  );
  if (!tank.volumeCurveId) {
    updateQuantityStatsDeprecated(
      statsMap,
      "minLevel",
      tank.minLevel,
      units,
      formatting,
      id,
      { emptyLabel: "none" },
    );
    updateQuantityStatsDeprecated(
      statsMap,
      "maxLevel",
      tank.maxLevel,
      units,
      formatting,
      id,
      { emptyLabel: "none" },
    );
    updateQuantityStatsDeprecated(
      statsMap,
      "diameter",
      tank.diameter,
      units,
      formatting,
      id,
      { emptyLabel: "none" },
    );
    updateQuantityStatsDeprecated(
      statsMap,
      "minVolume",
      tank.minVolume ?? DEFAULT_MIN_VOLUME,
      units,
      formatting,
      id,
    );
    updateQuantityStatsDeprecated(
      statsMap,
      "maxVolume",
      tank.maxVolume,
      units,
      formatting,
      id,
      { emptyLabel: "none" },
    );
    updateLinkStatsDeprecated(statsMap, "volumeCurve", null, id, "none");
  } else {
    const curve = curves.get(tank.volumeCurveId);
    if (curve) {
      updateLinkStatsDeprecated(
        statsMap,
        "volumeCurve",
        curve.label,
        id,
        "none",
      );
      const range = tankVolumeCurveRange(curve);
      updateQuantityStatsDeprecated(
        statsMap,
        "minLevel",
        range.minLevel,
        units,
        formatting,
        id,
      );
      updateQuantityStatsDeprecated(
        statsMap,
        "maxLevel",
        range.maxLevel,
        units,
        formatting,
        id,
      );
      updateQuantityStatsDeprecated(
        statsMap,
        "minVolume",
        range.minVolume,
        units,
        formatting,
        id,
      );
      updateQuantityStatsDeprecated(
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
    updateBooleanStatsDeprecated(statsMap, "canOverflow", tank.overflow, id);
  }

  updateQuantityStatsDeprecated(
    statsMap,
    "initialQuality",
    tank.initialQuality ?? DEFAULT_INITIAL_QUALITY,
    units,
    formatting,
    id,
  );
  updateQuantityStatsDeprecated(
    statsMap,
    "bulkReactionCoeff",
    tank.bulkReactionCoeff,
    units,
    formatting,
    id,
    {
      emptyLabel: "globalDefault",
      emptyValue: simulationSettings.reactionGlobalBulk,
    },
  );
  updateCategoryStatsDeprecated(
    statsMap,
    "chemicalSourceType",
    tank.chemicalSourceType ? "source." + tank.chemicalSourceType : undefined,
    id,
    "none",
  );
  if (tank.chemicalSourceType) {
    updateQuantityStatsDeprecated(
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
    updateLinkStatsDeprecated(
      statsMap,
      "chemicalSourcePattern",
      tankPattern?.label,
      id,
      "none",
    );
  }

  const mixingLabel = "tank." + tank.mixingModel;
  updateCategoryStatsDeprecated(statsMap, "mixingModel", mixingLabel, id);
  updateQuantityStatsDeprecated(
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
    updateQuantityStatsDeprecated(
      statsMap,
      "pressure",
      pressure,
      units,
      formatting,
      id,
    );
  }
  if (head !== null) {
    updateQuantityStatsDeprecated(
      statsMap,
      "head",
      head,
      units,
      formatting,
      id,
    );
  }
  if (netFlow !== null) {
    updateQuantityStatsDeprecated(
      statsMap,
      "netFlow",
      netFlow,
      units,
      formatting,
      id,
    );
  }
  if (level !== null) {
    updateQuantityStatsDeprecated(
      statsMap,
      "level",
      level,
      units,
      formatting,
      id,
    );
  }
  if (volume !== null) {
    updateQuantityStatsDeprecated(
      statsMap,
      "volume",
      volume,
      units,
      formatting,
      id,
    );
  }
  const waterAge = tankSim?.waterAge ?? null;
  if (waterAge !== null) {
    updateQuantityStatsDeprecated(
      statsMap,
      "waterAge",
      waterAge,
      units,
      formatting,
      id,
    );
  }
  const waterTrace = tankSim?.waterTrace ?? null;
  if (waterTrace !== null) {
    updateQuantityStatsDeprecated(
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
    updateQuantityStatsDeprecated(
      statsMap,
      "chemicalConcentration",
      chemicalConcentration,
      units,
      formatting,
      id,
    );
  }
};

const buildTankSectionsDeprecated = (
  statsMap: Map<string, PropertyStatsDeprecated>,
): AssetPropertySectionsDeprecated => {
  // Remove volumeCurve row if no tanks actually have curves
  const curveStats = statsMap.get("volumeCurve") as
    | LiteralCategoryStatsDeprecated
    | undefined;
  if (curveStats && curveStats.values.size === 0 && !!curveStats.emptyBucket) {
    statsMap.delete("volumeCurve");
  }

  return {
    activeTopology: getStatsForPropertiesDeprecated(statsMap, ["isEnabled"]),
    modelAttributes: getStatsForPropertiesDeprecated(statsMap, [
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
    quality: getStatsForPropertiesDeprecated(statsMap, [
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
    simulationResults: getStatsForPropertiesDeprecated(statsMap, [
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

const updateCustomerCountStatsDeprecated = (
  statsMap: Map<string, PropertyStatsDeprecated>,
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

  const stats = statsMap.get(property) as QuantityStatsDeprecated;

  if (value < stats.min) stats.min = value;
  if (value > stats.max) stats.max = value;

  stats.sum += value;
  stats.times += 1;
  const ids = stats.values.get(value) || [];
  ids.push(assetId);
  stats.values.set(value, ids);

  const mean = stats.sum / stats.times;
  stats.mean = roundToDecimalDeprecated(mean, 0);
};

const getStatsForPropertiesDeprecated = (
  statsMap: Map<string, PropertyStatsDeprecated>,
  properties: string[],
): PropertyStatsDeprecated[] => {
  const result: PropertyStatsDeprecated[] = [];

  for (const property of properties) {
    const stats = statsMap.get(property);
    if (stats) {
      result.push(stats);
    }
  }

  return result;
};
