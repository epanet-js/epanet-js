import { z } from "zod";
import type { NumericCheckName } from "@epanet-js/hydraulic-model";

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const isNumber = (value: unknown): boolean =>
  z.number().safeParse(value).success;

export const checkMessage: Record<NumericCheckName, string> = {
  positive: "mustBePositive",
  nonNegative: "mustBeNonNegative",
  unitRange: "mustBeWithinUnitRange",
  year: "invalidYear",
};
