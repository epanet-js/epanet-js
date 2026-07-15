import type {
  CustomAttribute,
  CustomAttributeAssetType,
  CustomAttributeId,
  CustomAttributesDefinition,
} from "@epanet-js/hydraulic-model";
import { customAttributesDefinitionSchema } from "@epanet-js/ejsdb";

export const buildCustomAttributesDefinition = (
  data: string | null,
): CustomAttributesDefinition => {
  const definition: CustomAttributesDefinition = new Map();
  if (data === null) return definition;

  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch (error) {
    throw new Error("Custom attributes: data is not valid JSON", {
      cause: error,
    });
  }

  const result = customAttributesDefinitionSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Custom attributes: data does not match schema — ${result.error.message}`,
    );
  }

  for (const [assetType, attributes] of Object.entries(result.data)) {
    const byId = new Map<CustomAttributeId, CustomAttribute>();
    for (const attribute of attributes ?? []) {
      byId.set(attribute.id, {
        id: attribute.id,
        label: attribute.label,
        type: attribute.type,
      });
    }
    if (byId.size > 0) {
      definition.set(assetType as CustomAttributeAssetType, byId);
    }
  }
  return definition;
};
