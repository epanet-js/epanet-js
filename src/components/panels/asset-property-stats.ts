import { Asset } from "src/hydraulic-model";

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

const propsToSkip = ["connections"];

export const computePropertyStats = (assets: Asset[]): StatsMap => {
  const statsMap = new Map();
  for (const asset of assets) {
    const properties = asset.listProperties();
    for (const property of properties) {
      if (propsToSkip.includes(property)) continue;
      const value = asset.getProperty(property) as unknown as number;
      if (typeof value === "string") {
        updateCategoryStats(statsMap, property, value);
      } else {
        updateQuantityStats(statsMap, property, value);
      }
    }
  }

  return statsMap;
};

const updateQuantityStats = (
  statsMap: StatsMap,
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
    });
  }

  const propertyStats = statsMap.get(property) as QuantityStats;

  if (value < propertyStats.min) propertyStats.min = value;
  if (value > propertyStats.max) propertyStats.max = value;

  propertyStats.sum += value;
  propertyStats.times += 1;

  propertyStats.values.set(value, (propertyStats.values.get(value) || 0) + 1);

  propertyStats.mean = propertyStats.sum / propertyStats.times;
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
