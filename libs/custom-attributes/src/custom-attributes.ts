import {
  type CustomAttributesDefinition,
  type CustomAttributeAssetType,
  type CustomAttributeId,
  type CustomAttributeType,
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

export class CustomAttributes {
  constructor(
    private readonly definition: CustomAttributesDefinition,
    private readonly data: CustomAttributesData = emptyCustomAttributesData(),
  ) {}

  getAttributesFor(
    id: number,
    type: CustomAttributeAssetType,
  ): ResolvedCustomAttribute[] {
    return getAttributes(this.definition, type).map((attribute) => ({
      id: attribute.id,
      type: attribute.type,
      label: attribute.label,
      value: getValue(this.data, id, attribute.id),
    }));
  }
}
