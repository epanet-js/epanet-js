import type { CustomAttributeValues } from "../network-data";
import type {
  CustomAttributeId,
  CustomAttributeType,
} from "@epanet-js/hydraulic-model";

export type AttributeValue = string | number;

export type CustomAttributePlan = Map<
  string,
  { id: CustomAttributeId; type: CustomAttributeType }
>;

export const resolveCustomAttributeValues = (
  record: { customAttributes?: CustomAttributeValues },
  attributes: CustomAttributePlan,
): Map<CustomAttributeId, AttributeValue> => {
  const values = new Map<CustomAttributeId, AttributeValue>();
  for (const [ref, raw] of Object.entries(record.customAttributes ?? {})) {
    const attribute = attributes.get(ref);
    if (!attribute) continue;

    const value = convert(raw, attribute.type);
    if (value !== null) values.set(attribute.id, value);
  }
  return values;
};

const convert = (
  value: AttributeValue,
  type: CustomAttributeType,
): AttributeValue | null => {
  if (type === "text") return String(value);
  if (typeof value === "number") return value;

  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};
