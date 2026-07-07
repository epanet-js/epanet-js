import type {
  CustomAttribute,
  CustomAttributeValue,
} from "@epanet-js/custom-attributes";
import {
  UnitsSpec,
  FormattingSpec,
} from "src/lib/project-settings/quantities-spec";
import {
  type PropertyStats,
  updateCategoryStats,
  updateQuantityStats,
} from "./stats";
import {
  type PropertyStats as SummaryPropertyStats,
  type Accumulator,
  finalizeStats,
  updateCategoryStats as updateCategorySummary,
  updateQuantityStats as updateQuantitySummary,
} from "./summary-stats";

export const buildCustomAttributeStats = (
  attribute: CustomAttribute,
  valuesById: Array<[number, CustomAttributeValue]>,
  units: UnitsSpec,
  formatting: FormattingSpec,
): PropertyStats => {
  const statsMap = new Map<string, PropertyStats>();

  for (const [assetId, value] of valuesById) {
    if (attribute.type === "number") {
      updateQuantityStats(
        statsMap,
        attribute.id,
        typeof value === "number" ? value : null,
        units,
        formatting,
        assetId,
        { unit: null, emptyLabel: "empty" },
      );
    } else {
      updateCategoryStats(
        statsMap,
        attribute.id,
        typeof value === "string" ? value : null,
        assetId,
        "empty",
      );
    }
  }

  return statsMap.get(attribute.id)!;
};

export const buildCustomAttributeSummary = (
  attribute: CustomAttribute,
  valuesById: Array<[number, CustomAttributeValue]>,
  units: UnitsSpec,
  formatting: FormattingSpec,
): SummaryPropertyStats => {
  const statsMap = new Map<string, Accumulator>();

  for (const [assetId, value] of valuesById) {
    if (attribute.type === "number") {
      updateQuantitySummary(
        statsMap,
        attribute.id,
        typeof value === "number" ? value : null,
        units,
        formatting,
        assetId,
        { unit: null, emptyLabel: "empty" },
      );
    } else {
      updateCategorySummary(
        statsMap,
        attribute.id,
        typeof value === "string" ? value : null,
        assetId,
        "empty",
      );
    }
  }

  return finalizeStats(statsMap.get(attribute.id)!);
};
