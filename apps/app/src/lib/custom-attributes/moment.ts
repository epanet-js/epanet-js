import type {
  CustomAttributeId,
  CustomAttributeValue,
  CustomAttributeValues,
  CustomAttributesDefinition,
} from "@epanet-js/custom-attributes";

export type CustomAttributeValueChange = {
  assetId: number;
  attributeId: CustomAttributeId;
  value: CustomAttributeValue;
};

export type CustomAttributeAssetValues = {
  assetId: number;
  values: CustomAttributeValues;
};

export type CustomAttributesMoment = {
  putValues: CustomAttributeAssetValues[];
  putDefinition?: CustomAttributesDefinition;
};
