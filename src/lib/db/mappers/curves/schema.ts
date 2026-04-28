import { z } from "zod";

export type CurveRow = {
  id: number;
  label: string;
  type: string | null;
  points: string;
};

export const pointsSchema = z.array(
  z.object({
    x: z.number().finite(),
    y: z.number().finite(),
  }),
);
