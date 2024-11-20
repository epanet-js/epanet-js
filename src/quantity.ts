import Qty from "js-quantities";

export type Unit = "m" | "mm" | "in" | "ft" | "l/s" | null;

export type Quantity = {
  value: number;
  unit: Unit;
};

export type Spec<T> = {
  [key in keyof T]: Quantity;
};

export const convertTo = (quantity: Quantity, unit: Unit): number => {
  if (quantity.unit === null || unit === null) return quantity.value;

  return new Qty(quantity.value, quantity.unit).to(unit).scalar;
};

export const canonicalize = <T>(spec: Spec<T>, canonicalSpec: Spec<T>) => {
  return Object.keys(spec).reduce(
    (acc, key) => {
      const fromQuantity = spec[key as keyof Spec<T>];
      const canonicalUnit = canonicalSpec[key as keyof Spec<T>].unit;
      acc[key] = convertTo(fromQuantity, canonicalUnit);
      return acc;
    },
    {} as { [key: string]: number },
  );
};

export const getValues = <T>(spec: Spec<T>) => {
  return Object.keys(spec).reduce(
    (acc, key) => {
      const quantity = spec[key as keyof T];
      acc[key] = quantity.value;
      return acc;
    },
    {} as { [key: string]: number },
  );
};
export const getUnits = <T>(spec: Spec<T>) => {
  return Object.keys(spec).reduce(
    (acc, key) => {
      const quantity = spec[key as keyof T];
      acc[key] = quantity.unit;
      return acc;
    },
    {} as { [key: string]: Unit },
  );
};
