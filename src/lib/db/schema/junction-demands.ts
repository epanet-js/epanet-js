import { z } from "zod";

export const junctionDemandRowSchema = z.object({
  junction_id: z.number().int(),
  ordinal: z.number().int(),
  base_demand: z.number().finite(),
  pattern_id: z.number().int().nullable(),
});

export type JunctionDemandRow = z.infer<typeof junctionDemandRowSchema>;
