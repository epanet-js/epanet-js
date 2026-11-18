import { z } from "zod";

// Year is intentionally stricter than the permissive DB schema, so it keeps its
// own range here. Material has no constraints, so it needs no validator.
export const isValidInstallationYear = (year: number) =>
  Number.isInteger(year) && year >= 1000 && year <= 9999;

const fromSchema =
  (schema: z.ZodTypeAny) =>
  (value: unknown): boolean =>
    schema.safeParse(value).success;

export const numericChecks = {
  positive: fromSchema(z.number().positive()),
  nonNegative: fromSchema(z.number().nonnegative()),
  unitRange: fromSchema(z.number().min(0).max(1)),
  year: (value: unknown) =>
    typeof value === "number" && isValidInstallationYear(value),
} satisfies Record<string, (value: number) => boolean>;

export type NumericCheckName = keyof typeof numericChecks;
