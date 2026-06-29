import type {
  CustomAttributeId,
  CustomAttributeValue,
} from "@epanet-js/custom-attributes";

export type CustomAttributeValueChange = {
  assetId: number;
  attributeId: CustomAttributeId;
  value: CustomAttributeValue;
};

export type CustomAttributesMoment = {
  putValues: CustomAttributeValueChange[];
};
