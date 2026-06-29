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
