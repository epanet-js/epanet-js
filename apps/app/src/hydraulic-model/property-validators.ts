import { z } from "zod";

// Year is intentionally stricter than the permissive DB schema, so it keeps its
// own range here. Material has no constraints, so it needs no validator.
const yearSchema = z.number().int().min(1000).max(9999);

export const isValidInstallationYear = (year: number) =>
  yearSchema.safeParse(year).success;
