import Qty from "js-quantities";

export type Unit =
  | "m"
  | "mm"
  | "in"
  | "ft"
  | "l/s"
  | "l/h"
  | "km"
  | "gal/min"
  | null;

export type Quantity = {
  value: number;
  unit: Unit;
};

export type QuantityMap<T> = {
  [key in keyof T]: Quantity;
};

export type QuantityOrNumberMap<T> = {
  [key in keyof T]: Quantity | number;
};

export const convertTo = (quantity: Quantity, unit: Unit): number => {
  if (quantity.unit === null || unit === null) return quantity.value;

  return new Qty(quantity.value, quantity.unit).to(unit).scalar;
};

export const createCanonicalMap =
  <T>(canonicalSpec: QuantityMap<T>) =>
  (inputQuantities: Partial<QuantityOrNumberMap<T>>, key: keyof T): number => {
    const quantityOrNumber = inputQuantities[key];
    if (quantityOrNumber === undefined) {
      return canonicalSpec[key].value;
    }

    if (typeof quantityOrNumber === "object") {
      return convertTo(quantityOrNumber, canonicalSpec[key].unit);
    }

    return quantityOrNumber;
  };
