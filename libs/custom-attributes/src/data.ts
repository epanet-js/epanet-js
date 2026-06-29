import type { CustomAttributeId } from "./definition";

export type CustomAttributeValue = string | number | null;

export type CustomAttributeValues = Map<
  CustomAttributeId,
  CustomAttributeValue
>;

export type CustomAttributesData = Map<number, CustomAttributeValues>;

export const emptyCustomAttributesData = (): CustomAttributesData => new Map();

export const getValue = (
  data: CustomAttributesData,
  assetId: number,
  attributeId: CustomAttributeId,
): CustomAttributeValue => {
  const value = data.get(assetId)?.get(attributeId);
  return value === undefined ? null : value;
};

export const setValue = (
  data: CustomAttributesData,
  assetId: number,
  attributeId: CustomAttributeId,
  value: CustomAttributeValue,
): CustomAttributesData => {
  const next: CustomAttributesData = new Map(data);

  const values: CustomAttributeValues = new Map(next.get(assetId));
  next.set(assetId, values);

  values.set(attributeId, value);

  return next;
};
