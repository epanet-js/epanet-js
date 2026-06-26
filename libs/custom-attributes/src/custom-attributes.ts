import {
  type CustomAttributesDefinition,
  type CustomAttributeAssetType,
  type CustomAttributeId,
  type CustomAttributeType,
  getAttributes,
} from "./definition";

export type ResolvedCustomAttribute = {
  id: CustomAttributeId;
  type: CustomAttributeType;
  label: string;
  value: string | number | null;
};

export class CustomAttributes {
  constructor(private readonly definition: CustomAttributesDefinition) {}

  getAttributesFor(
    id: number,
    type: CustomAttributeAssetType,
  ): ResolvedCustomAttribute[] {
    return getAttributes(this.definition, type).map((attribute) => ({
      id: attribute.id,
      type: attribute.type,
      label: attribute.label,
      value: null,
    }));
  }
}
