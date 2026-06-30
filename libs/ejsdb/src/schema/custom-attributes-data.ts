import { z } from "zod";

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

export const customAttributesDataRowSchema = z.object({
  asset_id: z.number().int(),
  data: z.string(),
});

export type CustomAttributesDataRow = z.infer<
  typeof customAttributesDataRowSchema
>;
