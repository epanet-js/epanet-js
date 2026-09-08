import { curvePointsCell, curveTypes } from "@epanet-js/model-schema";
import { z } from "zod";

export const curveTypeSchema = z.enum(curveTypes);

export const pointsSchema = curvePointsCell;

export const curveRowSchema = z.object({
  id: z.number().int(),
  label: z.string(),
  type: curveTypeSchema.nullable(),
  points: z.string(),
});

export type CurveRow = z.infer<typeof curveRowSchema>;
