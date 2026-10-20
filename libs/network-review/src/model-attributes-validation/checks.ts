import { z } from "zod";

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

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

export const isNumber = fromSchema(z.number());

export const checkMessage: Record<NumericCheckName, string> = {
  positive: "mustBePositive",
  nonNegative: "mustBeNonNegative",
  unitRange: "mustBeWithinUnitRange",
  year: "invalidYear",
};
