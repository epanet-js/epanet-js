import { z } from "zod";

export const scriptRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  source: z.string(),
  api_version: z.number().int().positive(),
  updated_at: z.number().int().nonnegative(),
});

export type ScriptRow = z.infer<typeof scriptRowSchema>;
