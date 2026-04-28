import { z } from "zod";

export type PatternRow = {
  id: number;
  label: string;
  type: string | null;
  multipliers: string;
};

export const multipliersSchema = z.array(z.number().finite());
