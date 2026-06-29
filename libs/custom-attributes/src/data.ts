import type { CustomAttributeAssetType, CustomAttributeId } from "./definition";

export type CustomAttributeValue = string | number | null;

export type CustomAttributeValues = Map<
  CustomAttributeId,
  CustomAttributeValue
>;

export type CustomAttributesData = Map<
  CustomAttributeAssetType,
  Map<number, CustomAttributeValues>
>;

export const emptyCustomAttributesData = (): CustomAttributesData => new Map();

export const getValue = (
  data: CustomAttributesData,
  assetType: CustomAttributeAssetType,
  assetId: number,
  attributeId: CustomAttributeId,
): CustomAttributeValue => {
  const value = data.get(assetType)?.get(assetId)?.get(attributeId);
  return value === undefined ? null : value;
};

export const setValue = (
  data: CustomAttributesData,
  assetType: CustomAttributeAssetType,
  assetId: number,
  attributeId: CustomAttributeId,
  value: CustomAttributeValue,
): CustomAttributesData => {
  const next: CustomAttributesData = new Map(data);

  const byAsset = new Map(next.get(assetType));
  next.set(assetType, byAsset);

  const values: CustomAttributeValues = new Map(byAsset.get(assetId));
  byAsset.set(assetId, values);

  values.set(attributeId, value);

  return next;
};
