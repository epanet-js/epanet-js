export const MAX_ENUM_VALUES = 20;

export const EMPTY_VALUE_KEY = "";

export const isBlank = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.replace(/[\s\0]+/g, "") === "") ||
  (typeof value === "number" && Number.isNaN(value));

export const valueKeyOf = (value: unknown): string =>
  isBlank(value) ? EMPTY_VALUE_KEY : String(value).trim();
