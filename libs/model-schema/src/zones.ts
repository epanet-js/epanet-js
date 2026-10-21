import { z } from "zod";
import { numberCell } from "./cells";

export const zoneGeometrySchema = z.object({
  type: z.literal("MultiPolygon"),
  coordinates: z.array(z.array(z.array(z.array(numberCell)))),
});

export const zoneBboxSchema = z.array(numberCell);
