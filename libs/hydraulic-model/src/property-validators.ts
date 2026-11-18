import { z } from "zod";

// Year is intentionally stricter than the permissive DB schema, so it keeps its
// own range here. Material has no constraints, so it needs no validator.
export const isValidInstallationYear = (year: number) =>
  Number.isInteger(year) && year >= 1000 && year <= 9999;

const fromSchema =
  (schema: z.ZodTypeAny) =>
  (value: unknown): boolean =>
    schema.safeParse(value).success;

const range = ({
  min,
  max,
  int = false,
}: {
  min?: number;
  max?: number;
  int?: boolean;
}): ((value: unknown) => boolean) => {
  let schema = int ? z.number().int() : z.number();
  if (min !== undefined) schema = schema.min(min);
  if (max !== undefined) schema = schema.max(max);
  return fromSchema(schema);
};

export const numericChecks = {
  positive: fromSchema(z.number().positive()),
  nonNegative: fromSchema(z.number().nonnegative()),
  unitRange: range({ min: 0, max: 1 }),
  year: range({ min: 1000, max: 9999, int: true }),
} satisfies Record<string, (value: number) => boolean>;

export type NumericCheckName = keyof typeof numericChecks;
