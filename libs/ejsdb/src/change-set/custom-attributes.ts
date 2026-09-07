import { CUSTOM_ATTRIBUTE_KEY_PREFIX } from "../schema/custom-attributes-data";

const isCustomAttributeKey = (key: string): boolean =>
  key.startsWith(CUSTOM_ATTRIBUTE_KEY_PREFIX);

export const customAttributesFrom = (
  fields: Record<string, unknown>,
): string | null => {
  const data: Record<string, string | number> = {};
  let hasValues = false;
  for (const key in fields) {
    if (!isCustomAttributeKey(key)) continue;
    const value = fields[key];
    if (value === null || value === undefined) continue;
    data[key] = value as string | number;
    hasValues = true;
  }
  return hasValues ? JSON.stringify(data) : null;
};

export const customAttributesDelta = (
  fields: Record<string, unknown>,
): string | null => {
  const delta: Record<string, string | number | null> = {};
  let hasCustom = false;
  for (const key in fields) {
    if (!isCustomAttributeKey(key)) continue;
    const value = fields[key];
    delta[key] = value === undefined ? null : (value as string | number | null);
    hasCustom = true;
  }
  return hasCustom ? JSON.stringify(delta) : null;
};
