import { numberCell } from "@epanet-js/model-schema";
import { z } from "zod";

export const zoneRowSchema = z.object({
  id: z.number(),
  label: z.string(),
  geometry: z.string(),
  bbox: z.string(),
});

export type ZoneRow = z.infer<typeof zoneRowSchema>;

export const zoneGeometrySchema = z.object({
  type: z.literal("MultiPolygon"),
  coordinates: z.array(z.array(z.array(z.array(numberCell)))),
});

export const zoneBboxSchema = z.array(numberCell);
