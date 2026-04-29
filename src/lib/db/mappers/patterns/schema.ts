import { z } from "zod";

export const patternTypeSchema = z.enum([
  "demand",
  "reservoirHead",
  "pumpSpeed",
  "qualitySourceStrength",
  "energyPrice",
]);

export const multipliersSchema = z.array(z.number().finite());

export const patternRowSchema = z.object({
  id: z.number().int(),
  label: z.string(),
  type: patternTypeSchema.nullable(),
  multipliers: z.string(),
});

export type PatternRow = z.infer<typeof patternRowSchema>;
