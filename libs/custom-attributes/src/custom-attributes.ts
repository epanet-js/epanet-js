import {
  type CustomAttributesDefinition,
  type CustomAttributeAssetType,
  type CustomAttributeId,
  type CustomAttributeType,
  emptyCustomAttributesDefinition,
  getAttributes,
} from "./definition";
import {
  type CustomAttributesData,
  type CustomAttributeValue,
  emptyCustomAttributesData,
  getValue,
} from "./data";

export type ResolvedCustomAttribute = {
  id: CustomAttributeId;
  type: CustomAttributeType;
  label: string;
  value: CustomAttributeValue;
};

export type CustomAttributes = {
  definition: CustomAttributesDefinition;
  data: CustomAttributesData;
};

export const emptyCustomAttributes = (): CustomAttributes => ({
  definition: emptyCustomAttributesDefinition(),
  data: emptyCustomAttributesData(),
});

export const resolveAttributesFor = (
  { definition, data }: CustomAttributes,
  id: number,
  type: CustomAttributeAssetType,
): ResolvedCustomAttribute[] =>
  getAttributes(definition, type).map((attribute) => ({
    id: attribute.id,
    type: attribute.type,
    label: attribute.label,
    value: getValue(data, id, attribute.id),
  }));
