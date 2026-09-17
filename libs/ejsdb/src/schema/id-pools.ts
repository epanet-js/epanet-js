import { z } from "zod";

const poolValue = z.number().int().nonnegative();

export const idPoolsSchema = z.object({
  asset: poolValue,
  customerPoint: poolValue,
  pattern: poolValue,
  curve: poolValue,
  zone: poolValue,
});

export type IdPoolsData = z.infer<typeof idPoolsSchema>;
