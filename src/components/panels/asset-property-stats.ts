import { Asset, Junction, Pipe } from "src/hydraulic-model";
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

const propsToSkip = ["connections"];

export const computePropertyStats = (
  assets: Asset[],
  quantitiesMetadata: Quantities,
): StatsMap => {
  const statsMap = new Map();
  for (const asset of assets) {
    const properties = asset.listProperties();
    for (const property of properties) {
      if (propsToSkip.includes(property)) continue;
      const value = asset.getProperty(property) as unknown as number;
      if (typeof value === "string") {
        updateCategoryStats(statsMap, property, value);
      } else {
        updateQuantityStats(statsMap, property, value, quantitiesMetadata);
      }
    }
    if (asset.type === "pipe") {
      const flow = (asset as Pipe).flow;
      if (flow !== null)
        updateQuantityStats(statsMap, "flow", flow, quantitiesMetadata);
      const velocity = (asset as Pipe).velocity;
      if (velocity !== null)
        updateQuantityStats(statsMap, "velocity", velocity, quantitiesMetadata);
    }
    if (asset.type === "junction") {
      const pressure = (asset as Junction).pressure;
      if (pressure !== null)
        updateQuantityStats(statsMap, "pressure", pressure, quantitiesMetadata);
    }
  }

  return statsMap;
};

const updateQuantityStats = (
  statsMap: StatsMap,
  property: string,
  value: number,
  quantitiesMetadata: Quantities,
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
