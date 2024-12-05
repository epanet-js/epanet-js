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
  | "psi"
  | null;

export type Quantity = {
  value: number;
  unit: Unit;
};

export type QuantitySpec = {
  defaultValue: number;
  unit: Unit;
  decimals?: number;
};

export type QuantityMap<T> = {
  [key in keyof T]: Quantity;
};

export type QuantityOrNumberMap<T> = {
  [key in keyof T]: Quantity | number;
};

export type QuantitiesSpec<T> = {
  [key in keyof T]: QuantitySpec;
};

export const convertTo = (quantity: Quantity, unit: Unit): number => {
  if (quantity.unit === null || unit === null) return quantity.value;

  return new Qty(quantity.value, quantity.unit).to(unit).scalar;
};
