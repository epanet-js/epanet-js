import Qty from "js-quantities";

export type Unit =
  | "m"
  | "mm"
  | "in"
  | "ft"
  | "l/s"
  | "l/min"
  | "l/h"
  | "l/d"
  | "km"
  | "m/km"
  | "ft/kft"
  | "gal/min"
  | "gal/d"
  | "mwc"
  | "psi"
  | "m/s"
  | "ft/s"
  | "ft^3"
  | "ft^3/s"
  | "ft^3/d"
  | "m^3"
  | "m^3/h"
  | "m^3/d"
  | "Mgal/d"
  | "IMgal/d"
  | "Ml/d"
  | "acft/d"
  | "kW"
  | "hp"
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
