import { z } from "zod";

export const zoneRowSchema = z.object({
  id: z.number(),
  label: z.string(),
  geometry: z.string(),
  bbox: z.string(),
});

export type ZoneRow = z.infer<typeof zoneRowSchema>;
