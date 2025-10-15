import { Asset, Junction, Pipe, Pump, Reservoir } from "src/hydraulic-model";
import { Tank, Valve } from "src/hydraulic-model/asset-types";
import { junctionQuantities } from "src/hydraulic-model/asset-types/junction";
import { pipeQuantities } from "src/hydraulic-model/asset-types/pipe";
import { reservoirQuantities } from "src/hydraulic-model/asset-types/reservoir";
import { roundToDecimal } from "src/infra/i18n/numbers";
import { DecimalsSpec, Quantities } from "src/model-metadata/quantities-spec";
import { valveStatusLabel } from "./asset-panel";

export type QuantityStatsDeprecated = {
  type: "quantity";
  property: string;
  sum: number;
  max: number;
  min: number;
  mean: number;
  values: Map<number, number>;
  times: number;
};

export type CategoryStats = {
  type: "category";
  property: string;
  values: Map<string, number>;
};

export type PropertyStats = QuantityStatsDeprecated | CategoryStats;

type StatsMap = Map<string, PropertyStats>;

export const computePropertyStats = (
  assets: Asset[],
  quantitiesMetadata: Quantities,
): StatsMap => {
  const statsMap = new Map();
  for (const asset of assets) {
    updateCategoryStats(statsMap, "type", asset.type);
    switch (asset.type) {
      case "pipe":
        appendPipeStats(statsMap, asset as Pipe, quantitiesMetadata);
        break;
      case "pump":
        appendPumpStats(statsMap, asset as Pump, quantitiesMetadata);
        break;
      case "junction":
        appendJunctionStats(statsMap, asset as Junction, quantitiesMetadata);
        break;
      case "reservoir":
        appendReservoirStats(statsMap, asset as Reservoir, quantitiesMetadata);
        break;
      case "valve":
        appendValveStats(statsMap, asset as Valve, quantitiesMetadata);
        break;
      case "tank":
        appendTankStats(statsMap, asset as Tank, quantitiesMetadata);
        break;
    }
  }

  return statsMap as StatsMap;
};

const appendPipeStats = (
  statsMap: StatsMap,
  pipe: Pipe,
  quantitiesMetadata: Quantities,
) => {
  if (pipe.status !== null) {
    const statusLabel =
      pipe.status === null ? "notAvailable" : "pipe." + pipe.status;
    updateCategoryStats(statsMap, "pipeStatus", statusLabel);
  }
  for (const name of pipeQuantities) {
    updateQuantityStatsDeprecated(
      statsMap,
      name,
      pipe[name as unknown as keyof Pipe] as number,
      quantitiesMetadata,
    );
  }
  if (pipe.headloss !== null)
    updateQuantityStatsDeprecated(
      statsMap,
      "headloss",
      pipe.headloss,
      quantitiesMetadata,
    );
  if (pipe.unitHeadloss !== null)
    updateQuantityStatsDeprecated(
      statsMap,
      "unitHeadloss",
      pipe.unitHeadloss,
      quantitiesMetadata,
    );
};

const appendValveStats = (
  statsMap: StatsMap,
  valve: Valve,
  quantitiesMetadata: Quantities,
) => {
  updateCategoryStats(statsMap, "valveType", `valve.${valve.kind}`);
  if (valve.status !== null)
    updateCategoryStats(statsMap, "valveStatus", valveStatusLabel(valve));
  if (valve.velocity !== null)
    updateQuantityStatsDeprecated(
      statsMap,
      "velocity",
      valve.velocity,
      quantitiesMetadata,
    );
  if (valve.headloss !== null)
    updateQuantityStatsDeprecated(
      statsMap,
      "headloss",
      valve.headloss,
      quantitiesMetadata,
    );
  if (valve.flow !== null)
    updateQuantityStatsDeprecated(
      statsMap,
      "flow",
      valve.flow,
      quantitiesMetadata,
    );
};

const appendPumpStats = (
  statsMap: StatsMap,
  pump: Pump,
  quantitiesMetadata: Quantities,
) => {
  updateCategoryStats(
    statsMap,
    "pumpType",
    pump.definitionType === "power" ? "power" : "flowVsHead",
  );
  if (pump.status !== null)
    updateCategoryStats(statsMap, "pumpStatus", pumpStatusLabel(pump));
  if (pump.head !== null)
    updateQuantityStatsDeprecated(
      statsMap,
      "pumpHead",
      pump.head,
      quantitiesMetadata,
    );
  if (pump.flow !== null)
    updateQuantityStatsDeprecated(
      statsMap,
      "flow",
      pump.flow,
      quantitiesMetadata,
    );
};

const appendJunctionStats = (
  statsMap: StatsMap,
  junction: Junction,
  quantitiesMetadata: Quantities,
) => {
  for (const name of junctionQuantities) {
    updateQuantityStatsDeprecated(
      statsMap,
      name,
      junction[name as unknown as keyof Junction] as number,
      quantitiesMetadata,
    );
  }
  if (junction.head !== null)
    updateQuantityStatsDeprecated(
      statsMap,
      "head",
      junction.head,
      quantitiesMetadata,
    );
  if (junction.actualDemand !== null)
    updateQuantityStatsDeprecated(
      statsMap,
      "actualDemand",
      junction.actualDemand,
      quantitiesMetadata,
    );
};

const appendReservoirStats = (
  statsMap: StatsMap,
  reservoir: Reservoir,
  quantitiesMetadata: Quantities,
) => {
  for (const name of reservoirQuantities) {
    updateQuantityStatsDeprecated(
      statsMap,
      name,
      reservoir[name as unknown as keyof Reservoir] as number,
      quantitiesMetadata,
    );
  }
};

const appendTankStats = (
  statsMap: StatsMap,
  tank: Tank,
  quantitiesMetadata: Quantities,
) => {
  updateQuantityStatsDeprecated(
    statsMap,
    "elevation",
    tank.elevation,
    quantitiesMetadata,
  );
  updateQuantityStatsDeprecated(
    statsMap,
    "initialLevel",
    tank.initialLevel,
    quantitiesMetadata,
  );
  updateQuantityStatsDeprecated(
    statsMap,
    "minLevel",
    tank.minLevel,
    quantitiesMetadata,
  );
  updateQuantityStatsDeprecated(
    statsMap,
    "maxLevel",
    tank.maxLevel,
    quantitiesMetadata,
  );
  updateQuantityStatsDeprecated(
    statsMap,
    "diameter",
    tank.diameter,
    quantitiesMetadata,
  );
  updateQuantityStatsDeprecated(
    statsMap,
    "minVolume",
    tank.minVolume,
    quantitiesMetadata,
  );
  if (tank.pressure !== null)
    updateQuantityStatsDeprecated(
      statsMap,
      "pressure",
      tank.pressure,
      quantitiesMetadata,
    );
  if (tank.head !== null)
    updateQuantityStatsDeprecated(
      statsMap,
      "head",
      tank.head,
      quantitiesMetadata,
    );
  if (tank.level !== null)
    updateQuantityStatsDeprecated(
      statsMap,
      "level",
      tank.level,
      quantitiesMetadata,
    );
  if (tank.volume !== null)
    updateQuantityStatsDeprecated(
      statsMap,
      "volume",
      tank.volume,
      quantitiesMetadata,
    );
};

const updateQuantityStatsDeprecated = (
  statsMap: StatsMap,
  property: string,
  value: number | null,
  quantitiesMetadata: Quantities,
) => {
  if (value === null) return;
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
    });
  }

  const decimalsToRound = quantitiesMetadata.getDecimals(
    property as keyof DecimalsSpec,
  );
  const roundedValue = roundToDecimal(value, decimalsToRound);

  const propertyStats = statsMap.get(property) as QuantityStatsDeprecated;

  if (roundedValue < propertyStats.min) propertyStats.min = roundedValue;
  if (roundedValue > propertyStats.max) propertyStats.max = roundedValue;

  propertyStats.sum += roundedValue;
  propertyStats.times += 1;

  propertyStats.values.set(
    roundedValue,
    (propertyStats.values.get(roundedValue) || 0) + 1,
  );

  const mean = propertyStats.sum / propertyStats.times;
  propertyStats.mean = roundToDecimal(mean, decimalsToRound);
};

const updateCategoryStats = (
  statsMap: StatsMap,
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

  const propertyStats = statsMap.get(property) as CategoryStats;
  propertyStats.values.set(value, (propertyStats.values.get(value) || 0) + 1);
};

const pumpStatusLabel = (pump: Pump) => {
  if (pump.status === null) return "notAvailable";

  if (pump.statusWarning) {
    return `pump.${pump.status}.${pump.statusWarning}`;
  }
  return "pump." + pump.status;
};
