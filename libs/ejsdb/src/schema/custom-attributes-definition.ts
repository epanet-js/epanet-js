import { z } from "zod";

export const customAttributeAssetTypes = [
  "pipe",
  "pump",
  "valve",
  "junction",
  "reservoir",
  "tank",
  "customerPoint",
] as const;

export const customAttributeTypes = ["text", "number"] as const;

const MAX_LABEL_LENGTH = 50;

const labelSchema = z
  .string()
  .refine((s) => s.trim().length >= 1 && s.trim().length <= MAX_LABEL_LENGTH);

const customAttributeSchema = z.object({
  id: z.string().min(1),
  label: labelSchema,
  type: z.enum(customAttributeTypes),
});

export const customAttributesDefinitionSchema = z.record(
  z.enum(customAttributeAssetTypes),
  z.array(customAttributeSchema),
);

export type CustomAttributesDefinitionData = z.infer<
  typeof customAttributesDefinitionSchema
>;
