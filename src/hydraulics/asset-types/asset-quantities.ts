import { QuantityOrNumberMap, Unit, convertTo } from "src/quantity";

export type AssetQuantitiesSpec<T> = {
  [key in keyof T]: { defaultValue: number; unit: Unit };
};

export const createCanonicalMap =
  <T>(canonicalSpec: AssetQuantitiesSpec<T>) =>
  (inputQuantities: Partial<QuantityOrNumberMap<T>>, key: keyof T): number => {
    const quantityOrNumber = inputQuantities[key];
    if (quantityOrNumber === undefined) {
      return canonicalSpec[key].defaultValue;
    }

    if (typeof quantityOrNumber === "object") {
      return convertTo(quantityOrNumber, canonicalSpec[key].unit);
    }

    return quantityOrNumber;
  };
