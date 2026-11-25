import type { ParseSensorDataResult } from "src/lib/sensor-data/parse-sensor-data-file";

const REFUSAL_CODES = new Set([
  "unsupportedFormat",
  "notAValidSensorFile",
  "missingSensorRow",
]);

export type Refusal = { code: string; params?: string[] };

export const refusalOf = (result: ParseSensorDataResult): Refusal | null => {
  const refusal = result.errors.find(({ code }) => REFUSAL_CODES.has(code));
  if (refusal) return { code: refusal.code, params: refusal.params };
  if (result.status === "error" && result.errors.length === 0) {
    return { code: "unreadableFile" };
  }
  return null;
};
