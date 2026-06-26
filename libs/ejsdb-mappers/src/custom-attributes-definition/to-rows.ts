import type { CustomAttributesDefinition } from "@epanet-js/custom-attributes";
import {
  customAttributesDefinitionSchema,
  type CustomAttributesDefinitionData,
} from "@epanet-js/ejsdb";

const toData = (
  definition: CustomAttributesDefinition,
): CustomAttributesDefinitionData => {
  const data: CustomAttributesDefinitionData = {};
  for (const [assetType, byId] of definition) {
    const attributes = [...byId.values()];
    if (attributes.length > 0) {
      data[assetType] = attributes;
    }
  }
  return data;
};

export const serializeCustomAttributesDefinition = (
  definition: CustomAttributesDefinition,
): string => {
  const result = customAttributesDefinitionSchema.safeParse(toData(definition));
  if (!result.success) {
    throw new Error(
      `Custom attributes: data does not match schema — ${result.error.message}`,
    );
  }
  return JSON.stringify(result.data);
};
