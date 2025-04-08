import { Asset, Junction, Pipe, Pump, Reservoir } from "src/hydraulic-model";
import { junctionQuantities } from "src/hydraulic-model/asset-types/junction";
import { pipeQuantities } from "src/hydraulic-model/asset-types/pipe";
import { reservoirQuantities } from "src/hydraulic-model/asset-types/reservoir";
import { roundToDecimal } from "src/infra/i18n/numbers";
import { DecimalsSpec, Quantities } from "src/model-metadata/quantities-spec";

export type QuantityStats = {
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

export type PropertyStats = QuantityStats | CategoryStats;

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
    }
  }

  return statsMap;
};

const appendPipeStats = (
  statsMap: StatsMap,
  pipe: Pipe,
  quantitiesMetadata: Quantities,
) => {
  updateCategoryStats(statsMap, "status", pipe.status);
  for (const name of pipeQuantities) {
    updateQuantityStats(
      statsMap,
      name,
      pipe[name as unknown as keyof Pipe] as number,
      quantitiesMetadata,
    );
  }
};

const appendPumpStats = (
  statsMap: StatsMap,
  pump: Pump,
  quantitiesMetadata: Quantities,
) => {
  for (const name of pipeQuantities) {
    updateQuantityStats(
      statsMap,
      name,
      pump[name as unknown as keyof Pump] as number,
      quantitiesMetadata,
    );
  }
};

const appendJunctionStats = (
  statsMap: StatsMap,
  junction: Junction,
  quantitiesMetadata: Quantities,
) => {
  for (const name of junctionQuantities) {
    updateQuantityStats(
      statsMap,
      name,
      junction[name as unknown as keyof Junction] as number,
      quantitiesMetadata,
    );
  }
};

const appendReservoirStats = (
  statsMap: StatsMap,
  reservoir: Reservoir,
  quantitiesMetadata: Quantities,
) => {
  for (const name of reservoirQuantities) {
    updateQuantityStats(
      statsMap,
      name,
      reservoir[name as unknown as keyof Reservoir] as number,
      quantitiesMetadata,
    );
  }
};

const updateQuantityStats = (
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

  const propertyStats = statsMap.get(property) as QuantityStats;

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
