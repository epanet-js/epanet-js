import { multipliersCell, patternTypes } from "@epanet-js/model-schema";
import { z } from "zod";

export const patternTypeSchema = z.enum(patternTypes);

export const multipliersSchema = multipliersCell;

export const patternRowSchema = z.object({
  id: z.number().int(),
  label: z.string(),
  type: patternTypeSchema.nullable(),
  multipliers: z.string(),
});

export type PatternRow = z.infer<typeof patternRowSchema>;
