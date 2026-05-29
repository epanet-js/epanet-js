import { z } from "zod";

const assetReferenceSchema = z.object({
  assetId: z.number(),
  isActionTarget: z.boolean(),
});

const simpleControlSchema = z.object({
  template: z.string(),
  assetReferences: z.array(assetReferenceSchema),
});

const ruleBasedControlSchema = z.object({
  ruleId: z.string(),
  template: z.string(),
  assetReferences: z.array(assetReferenceSchema),
});

export const controlsSchema = z.object({
  simple: z.array(simpleControlSchema),
  rules: z.array(ruleBasedControlSchema),
});
