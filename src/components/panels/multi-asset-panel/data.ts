import { Unit } from "src/quantity";
import {
  CategoryStats,
  QuantityStatsDeprecated,
} from "../asset-property-stats";
import { Quantities } from "src/model-metadata/quantities-spec";
import {
  Asset,
  Junction,
  Pipe,
  Pump,
  Reservoir,
  Tank,
} from "src/hydraulic-model";
import { Valve } from "src/hydraulic-model/asset-types";

export type QuantityStats = QuantityStatsDeprecated & {
  decimals: number;
  unit: Unit;
};

type Section = "modelAttributes" | "simulationResults" | "demands";

type AssetPropertyStats = QuantityStats | CategoryStats;

export type AssetPropertySections = {
  [section in Section]: AssetPropertyStats[];
};

export type MultiAssetsData = {
  [type in Asset["type"]]: AssetPropertySections;
};

export const computeMultiAssetData = (
  assets: Asset[],
  quantitiesMetadata: Quantities,
): MultiAssetsData => {
  const assetsByType = groupAssetsByType(assets);

  return {
    junction: computeJunctionData(assetsByType.junction, quantitiesMetadata),
    pipe: computePipeData(assetsByType.pipe, quantitiesMetadata),
    pump: computePumpData(assetsByType.pump, quantitiesMetadata),
    valve: computeValveData(assetsByType.valve, quantitiesMetadata),
    reservoir: computeReservoirData(assetsByType.reservoir, quantitiesMetadata),
    tank: computeTankData(assetsByType.tank, quantitiesMetadata),
  };
};

const groupAssetsByType = (assets: Asset[]) => {
  const grouped = {
    junction: [] as Asset[],
    pipe: [] as Asset[],
    pump: [] as Asset[],
    valve: [] as Asset[],
    reservoir: [] as Asset[],
    tank: [] as Asset[],
  };

  for (const asset of assets) {
    if (asset.type in grouped) {
      grouped[asset.type as keyof typeof grouped].push(asset);
    }
  }

  return grouped;
};

const computeJunctionData = (
  assets: Asset[],
  quantitiesMetadata: Quantities,
): AssetPropertySections => {
  const statsMap = new Map<string, AssetPropertyStats>();

  for (const asset of assets) {
    const junction = asset as Junction;
    updateQuantityStats(
      statsMap,
      "elevation",
      junction.elevation,
      quantitiesMetadata,
    );
    updateQuantityStats(
      statsMap,
      "baseDemand",
      junction.baseDemand,
      quantitiesMetadata,
    );

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
  }

  return {
    modelAttributes: getStatsForProperties(statsMap, ["elevation"]),
    demands: getStatsForProperties(statsMap, ["baseDemand"]),
    simulationResults: getStatsForProperties(statsMap, [
      "pressure",
      "head",
      "actualDemand",
    ]),
  };
};

const computePipeData = (
  assets: Asset[],
  quantitiesMetadata: Quantities,
): AssetPropertySections => {
  const statsMap = new Map<string, AssetPropertyStats>();

  for (const asset of assets) {
    const pipe = asset as Pipe;
    updateCategoryStats(statsMap, "initialStatus", pipe.initialStatus);
    updateQuantityStats(
      statsMap,
      "diameter",
      pipe.diameter,
      quantitiesMetadata,
    );
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
  }

  return {
    modelAttributes: getStatsForProperties(statsMap, [
      "initialStatus",
      "diameter",
      "length",
      "roughness",
      "minorLoss",
    ]),
    demands: [],
    simulationResults: getStatsForProperties(statsMap, [
      "flow",
      "velocity",
      "unitHeadloss",
      "headloss",
      "pipeStatus",
    ]),
  };
};

const computePumpData = (
  assets: Asset[],
  quantitiesMetadata: Quantities,
): AssetPropertySections => {
  const statsMap = new Map<string, AssetPropertyStats>();

  for (const asset of assets) {
    const pump = asset as Pump;
    const pumpType = pump.definitionType === "power" ? "power" : "flowVsHead";
    updateCategoryStats(statsMap, "pumpType", pumpType);
    updateCategoryStats(statsMap, "initialStatus", pump.initialStatus);

    if (pump.power !== null) {
      updateQuantityStats(statsMap, "power", pump.power, quantitiesMetadata);
    }
    if (pump.designFlow !== null) {
      updateQuantityStats(
        statsMap,
        "designFlow",
        pump.designFlow,
        quantitiesMetadata,
      );
    }
    if (pump.designHead !== null) {
      updateQuantityStats(
        statsMap,
        "designHead",
        pump.designHead,
        quantitiesMetadata,
      );
    }
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
  }

  return {
    modelAttributes: getStatsForProperties(statsMap, [
      "pumpType",
      "power",
      "designFlow",
      "designHead",
      "speed",
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

const computeValveData = (
  assets: Asset[],
  quantitiesMetadata: Quantities,
): AssetPropertySections => {
  const statsMap = new Map<string, AssetPropertyStats>();

  for (const asset of assets) {
    const valve = asset as Valve;
    updateCategoryStats(statsMap, "valveType", `valve.${valve.kind}`);
    updateCategoryStats(statsMap, "initialStatus", valve.initialStatus);
    updateQuantityStats(statsMap, "setting", valve.setting, quantitiesMetadata);
    updateQuantityStats(
      statsMap,
      "diameter",
      valve.diameter,
      quantitiesMetadata,
    );
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
  }

  return {
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

const computeReservoirData = (
  assets: Asset[],
  quantitiesMetadata: Quantities,
): AssetPropertySections => {
  const statsMap = new Map<string, AssetPropertyStats>();

  for (const asset of assets) {
    const reservoir = asset as Reservoir;
    updateQuantityStats(
      statsMap,
      "elevation",
      reservoir.elevation,
      quantitiesMetadata,
    );
    updateQuantityStats(statsMap, "head", reservoir.head, quantitiesMetadata);
  }

  return {
    modelAttributes: getStatsForProperties(statsMap, ["elevation", "head"]),
    demands: [],
    simulationResults: [],
  };
};

const computeTankData = (
  assets: Asset[],
  quantitiesMetadata: Quantities,
): AssetPropertySections => {
  const statsMap = new Map<string, AssetPropertyStats>();

  for (const asset of assets) {
    const tank = asset as Tank;
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
    updateQuantityStats(
      statsMap,
      "minLevel",
      tank.minLevel,
      quantitiesMetadata,
    );
    updateQuantityStats(
      statsMap,
      "maxLevel",
      tank.maxLevel,
      quantitiesMetadata,
    );
    updateQuantityStats(
      statsMap,
      "diameter",
      tank.diameter,
      quantitiesMetadata,
    );
    updateQuantityStats(
      statsMap,
      "minVolume",
      tank.minVolume,
      quantitiesMetadata,
    );

    if (tank.overflow !== undefined) {
      updateCategoryStats(statsMap, "overflow", tank.overflow ? "yes" : "no");
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
  }

  return {
    modelAttributes: getStatsForProperties(statsMap, [
      "elevation",
      "initialLevel",
      "minLevel",
      "maxLevel",
      "diameter",
      "minVolume",
      "overflow",
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
