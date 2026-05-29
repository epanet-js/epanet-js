import { z } from "zod";

export const curveTypeSchema = z.enum([
  "pump",
  "efficiency",
  "volume",
  "valve",
  "headloss",
]);

export const pointsSchema = z.array(
  z.object({
    x: z.number().finite(),
    y: z.number().finite(),
  }),
);

export const curveRowSchema = z.object({
  id: z.number().int(),
  label: z.string(),
  type: curveTypeSchema.nullable(),
  points: z.string(),
});

export type CurveRow = z.infer<typeof curveRowSchema>;
