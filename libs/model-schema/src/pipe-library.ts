import { z } from "zod";

const roughnessEntrySchema = z.object({
  age: z.number().nullable(),
  roughness: z.number().nullable(),
});

const pipeMaterialSchema = z.object({
  label: z.string(),
  entries: z.array(roughnessEntrySchema),
});

export const pipeLibrarySchema = z.array(pipeMaterialSchema);

export type PipeLibraryData = z.infer<typeof pipeLibrarySchema>;
