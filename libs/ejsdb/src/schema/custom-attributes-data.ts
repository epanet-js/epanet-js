import { z } from "zod";

export const CUSTOM_ATTRIBUTE_KEY_PREFIX = "custom-";

export const customAttributeValueSchema = z.union([
  z.string(),
  z.number(),
  z.null(),
]);

export const customAttributesDataSchema = z.record(
  z.string(),
  customAttributeValueSchema,
);

export type CustomAttributesDataObject = z.infer<
  typeof customAttributesDataSchema
>;
