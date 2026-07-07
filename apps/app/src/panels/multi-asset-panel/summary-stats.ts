import { Unit } from "@epanet-js/quantity";
import {
  UnitsSpec,
  FormattingSpec,
} from "src/lib/project-settings/quantities-spec";
import { getDecimals } from "src/lib/project-settings";

export type EmptySummary = {
  label: string;
  value?: number | null;
  count: number;
};

export type QuantityStats = {
  type: "quantity";
  property: string;
  distinctCount: number;
  singleValue: number | null;
  decimals: number;
  unit: Unit;
  isInteger?: boolean;
  emptyBucket?: EmptySummary;
};

export type CategoryStats = {
  type: "category";
  property: string;
  distinctCount: number;
  singleValue: string | null;
  distinctValues: string[];
  emptyBucket?: EmptySummary;
};

export type LiteralCategoryStats = {
  type: "literalCategory";
  property: string;
  distinctCount: number;
  singleValue: string | null;
  distinctValues: string[];
  emptyBucket?: EmptySummary;
};

export type BooleanStats = {
  type: "boolean";
  property: string;
  distinctCount: number;
  singleValue: string | null;
};

export type PropertyStats =
  | QuantityStats
  | CategoryStats
  | BooleanStats
  | LiteralCategoryStats;

export type QuantityAcc = {
  type: "quantity";
  property: string;
  seen: Set<number>;
  firstValue: number | null;
  decimals: number;
  unit: Unit;
  isInteger?: boolean;
  emptyBucket?: EmptySummary;
};

export type CategoryAcc = {
  type: "category";
  property: string;
  seen: Set<string>;
  firstValue: string | null;
  emptyBucket?: EmptySummary;
};

export type LiteralCategoryAcc = {
  type: "literalCategory";
  property: string;
  seen: Set<string>;
  firstValue: string | null;
  emptyBucket?: EmptySummary;
};

type BooleanAcc = {
  type: "boolean";
  property: string;
  seen: Set<string>;
  firstValue: string | null;
};

export type Accumulator =
  | QuantityAcc
  | CategoryAcc
  | LiteralCategoryAcc
  | BooleanAcc;

export const getEmptyBucket = (
  stats: PropertyStats,
): EmptySummary | undefined => {
  if (
    stats.type === "quantity" ||
    stats.type === "category" ||
    stats.type === "literalCategory"
  ) {
    return stats.emptyBucket;
  }
  return undefined;
};

export const getDistinctBucketCount = (stats: PropertyStats): number => {
  return stats.distinctCount + (getEmptyBucket(stats) ? 1 : 0);
};

export const finalizeStats = (acc: Accumulator): PropertyStats => {
  const distinctCount = acc.seen.size;
  const singleValue = distinctCount === 1 ? acc.firstValue : null;

  switch (acc.type) {
    case "quantity":
      return {
        type: "quantity",
        property: acc.property,
        distinctCount,
        singleValue: singleValue as number | null,
        decimals: acc.decimals,
        unit: acc.unit,
        isInteger: acc.isInteger,
        emptyBucket: acc.emptyBucket,
      };
    case "category":
      return {
        type: "category",
        property: acc.property,
        distinctCount,
        singleValue: singleValue as string | null,
        distinctValues: Array.from(acc.seen),
        emptyBucket: acc.emptyBucket,
      };
    case "literalCategory":
      return {
        type: "literalCategory",
        property: acc.property,
        distinctCount,
        singleValue: singleValue as string | null,
        distinctValues: Array.from(acc.seen),
        emptyBucket: acc.emptyBucket,
      };
    case "boolean":
      return {
        type: "boolean",
        property: acc.property,
        distinctCount,
        singleValue: singleValue as string | null,
      };
  }
};

export const updateQuantityStats = (
  statsMap: Map<string, Accumulator>,
  property: string,
  value: number | null | undefined,
  units: UnitsSpec,
  formatting: FormattingSpec,
  _id: number,
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
      seen: new Set(),
      firstValue: null,
      decimals,
      unit,
      isInteger: overrides?.isInteger,
    });
  }

  const acc = statsMap.get(property) as QuantityAcc;

  if (isEmpty) {
    if (!acc.emptyBucket) {
      acc.emptyBucket = {
        label: overrides!.emptyLabel!,
        value: overrides?.emptyValue,
        count: 0,
      };
    }
    acc.emptyBucket.count += 1;
    return;
  }

  const roundedValue = roundToDecimal(value, acc.decimals);
  addDistinct(acc, roundedValue);
};

export const updateCategoryStats = (
  statsMap: Map<string, Accumulator>,
  property: string,
  value: string | null | undefined,
  _id: number,
  emptyLabel?: string,
) => {
  const isEmpty = value === null || value === undefined || value === "";
  if (isEmpty && !emptyLabel) return;

  if (!statsMap.has(property)) {
    statsMap.set(property, {
      type: "category",
      property,
      seen: new Set(),
      firstValue: null,
    });
  }

  const acc = statsMap.get(property) as CategoryAcc;

  if (isEmpty) {
    if (!acc.emptyBucket) {
      acc.emptyBucket = { label: emptyLabel!, count: 0 };
    }
    acc.emptyBucket.count += 1;
    return;
  }

  addDistinct(acc, value);
};

export const updateLinkStats = (
  statsMap: Map<string, Accumulator>,
  property: string,
  linkLabel: string | null | undefined,
  _id: number,
  emptyLabel?: string,
) => {
  const isEmpty =
    linkLabel === null || linkLabel === undefined || linkLabel === "";
  if (isEmpty && !emptyLabel) return;

  if (!statsMap.has(property)) {
    statsMap.set(property, {
      type: "literalCategory",
      property,
      seen: new Set(),
      firstValue: null,
    });
  }

  const acc = statsMap.get(property) as LiteralCategoryAcc;

  if (isEmpty) {
    if (!acc.emptyBucket) {
      acc.emptyBucket = { label: emptyLabel!, count: 0 };
    }
    acc.emptyBucket.count += 1;
    return;
  }

  addDistinct(acc, linkLabel);
};

export const updateBooleanStats = (
  statsMap: Map<string, Accumulator>,
  property: string,
  value: boolean,
  _id: number,
) => {
  if (!statsMap.has(property)) {
    statsMap.set(property, {
      type: "boolean",
      property,
      seen: new Set(),
      firstValue: null,
    });
  }

  const label = value ? "yes" : "no";
  const acc = statsMap.get(property) as BooleanAcc;
  addDistinct(acc, label);
};

export const roundToDecimal = (value: number, decimals: number): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};

const addDistinct = (acc: Accumulator, value: number | string) => {
  const seen = acc.seen as Set<number | string>;
  if (seen.has(value)) return;
  if (seen.size === 0) {
    (acc as { firstValue: number | string | null }).firstValue = value;
  }
  seen.add(value);
};
