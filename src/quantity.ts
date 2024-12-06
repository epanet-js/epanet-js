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
  | "mwc"
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

export const convertTo = (quantity: Quantity, targetUnit: Unit): number => {
  if (quantity.unit === null || targetUnit === null) return quantity.value;
  if (quantity.unit === targetUnit) return quantity.value;

  let conversionQuantity: Qty;
  if (quantity.unit === "mwc") {
    conversionQuantity = new Qty(quantity.value * 100, "cmh2o");
  } else {
    conversionQuantity = new Qty(quantity.value, quantity.unit);
  }

  if (targetUnit === "mwc") {
    return conversionQuantity.to("cmh2o").scalar / 100;
  } else {
    return conversionQuantity.to(targetUnit).scalar;
  }
};
