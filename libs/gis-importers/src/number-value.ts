import { parseDecimal } from "@epanet-js/i18n/numbers";

export const numberOf = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return typeof value === "string" ? parseDecimal(value) : null;
};
