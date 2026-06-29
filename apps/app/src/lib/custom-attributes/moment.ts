import type {
  CustomAttributeAssetType,
  CustomAttributeId,
  CustomAttributeValue,
} from "@epanet-js/custom-attributes";

export type CustomAttributeValueChange = {
  assetType: CustomAttributeAssetType;
  assetId: number;
  attributeId: CustomAttributeId;
  value: CustomAttributeValue;
};

export type CustomAttributesMoment = {
  putValues: CustomAttributeValueChange[];
};
