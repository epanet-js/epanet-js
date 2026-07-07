import { Unit } from "@epanet-js/quantity";
import {
  UnitsSpec,
  FormattingSpec,
} from "src/lib/project-settings/quantities-spec";
import { getDecimals } from "src/lib/project-settings";

export type EmptyBucketDeprecated = {
  label: string;
  value?: number | null;
  ids: number[];
};

export type QuantityStatsDeprecated = {
  type: "quantity";
  property: string;
  sum: number;
  max: number;
  min: number;
  mean: number;
  values: Map<number, number[]>;
  times: number;
  decimals: number;
  unit: Unit;
  isInteger?: boolean;
  emptyBucket?: EmptyBucketDeprecated;
};

export type CategoryStatsDeprecated = {
  type: "category";
  property: string;
  values: Map<string, number[]>;
  emptyBucket?: EmptyBucketDeprecated;
};

export type LiteralCategoryStatsDeprecated = {
  type: "literalCategory";
  property: string;
  values: Map<string, number[]>;
  emptyBucket?: EmptyBucketDeprecated;
};

export type BooleanStatsDeprecated = {
  type: "boolean";
  property: string;
  values: Map<string, number[]>;
};

export type PropertyStatsDeprecated =
  | QuantityStatsDeprecated
  | CategoryStatsDeprecated
  | BooleanStatsDeprecated
  | LiteralCategoryStatsDeprecated;

export const getEmptyBucketDeprecated = (
  stats: PropertyStatsDeprecated,
): EmptyBucketDeprecated | undefined => {
  if (
    stats.type === "quantity" ||
    stats.type === "category" ||
    stats.type === "literalCategory"
  ) {
    return stats.emptyBucket;
  }
  return undefined;
};

export const getDistinctBucketCountDeprecated = (
  stats: PropertyStatsDeprecated,
): number => {
  return stats.values.size + (getEmptyBucketDeprecated(stats) ? 1 : 0);
};

export const updateQuantityStatsDeprecated = (
  statsMap: Map<string, PropertyStatsDeprecated>,
  property: string,
  value: number | null | undefined,
  units: UnitsSpec,
  formatting: FormattingSpec,
  id: number,
  overrides?: {
    unit?: Unit;
    decimals?: number;
    isInteger?: boolean;
    emptyLabel?: string;
    emptyValue?: number | null;
  },
) => {
  const isEmpty = value === null || value === undefined;
  if (isEmpty && !overrides?.emptyLabel) return;

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
      isInteger: overrides?.isInteger,
    });
  }

  const stats = statsMap.get(property) as QuantityStatsDeprecated;

  if (isEmpty) {
    if (!stats.emptyBucket) {
      stats.emptyBucket = {
        label: overrides!.emptyLabel!,
        value: overrides?.emptyValue,
        ids: [],
      };
    }
    stats.emptyBucket.ids.push(id);
    return;
  }

  const roundedValue = roundToDecimalDeprecated(value, stats.decimals);

  if (roundedValue < stats.min) stats.min = roundedValue;
  if (roundedValue > stats.max) stats.max = roundedValue;

  stats.sum += roundedValue;
  stats.times += 1;
  const ids = stats.values.get(roundedValue) || [];
  ids.push(id);
  stats.values.set(roundedValue, ids);

  const mean = stats.sum / stats.times;
  stats.mean = roundToDecimalDeprecated(mean, stats.decimals);
};

export const updateCategoryStatsDeprecated = (
  statsMap: Map<string, PropertyStatsDeprecated>,
  property: string,
  value: string | null | undefined,
  id: number,
  emptyLabel?: string,
) => {
  const isEmpty = value === null || value === undefined || value === "";
  if (isEmpty && !emptyLabel) return;

  if (!statsMap.has(property)) {
    statsMap.set(property, {
      type: "category",
      property,
      values: new Map(),
    });
  }

  const stats = statsMap.get(property) as CategoryStatsDeprecated;

  if (isEmpty) {
    if (!stats.emptyBucket) {
      stats.emptyBucket = { label: emptyLabel!, ids: [] };
    }
    stats.emptyBucket.ids.push(id);
    return;
  }

  const ids = stats.values.get(value) || [];
  ids.push(id);
  stats.values.set(value, ids);
};

export const updateLinkStatsDeprecated = (
  statsMap: Map<string, PropertyStatsDeprecated>,
  property: string,
  linkLabel: string | null | undefined,
  id: number,
  emptyLabel?: string,
) => {
  const isEmpty =
    linkLabel === null || linkLabel === undefined || linkLabel === "";
  if (isEmpty && !emptyLabel) return;

  if (!statsMap.has(property)) {
    statsMap.set(property, {
      type: "literalCategory",
      property,
      values: new Map(),
    });
  }

  const stats = statsMap.get(property) as LiteralCategoryStatsDeprecated;

  if (isEmpty) {
    if (!stats.emptyBucket) {
      stats.emptyBucket = { label: emptyLabel!, ids: [] };
    }
    stats.emptyBucket.ids.push(id);
    return;
  }

  const ids = stats.values.get(linkLabel) || [];
  ids.push(id);
  stats.values.set(linkLabel, ids);
};

export const updateBooleanStatsDeprecated = (
  statsMap: Map<string, PropertyStatsDeprecated>,
  property: string,
  value: boolean,
  id: number,
) => {
  if (!statsMap.has(property)) {
    statsMap.set(property, {
      type: "boolean",
      property,
      values: new Map(),
    });
  }

  const label = value ? "yes" : "no";
  const stats = statsMap.get(property) as BooleanStatsDeprecated;
  const ids = stats.values.get(label) || [];
  ids.push(id);
  stats.values.set(label, ids);
};

export const roundToDecimalDeprecated = (
  value: number,
  decimals: number,
): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};
