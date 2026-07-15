import { CustomerPoint } from "@epanet-js/hydraulic-model";
import { isCustomProperty } from "@epanet-js/hydraulic-model";
import { customAttributesDataSchema } from "@epanet-js/ejsdb";

export const serializeCustomerPointCustomAttributes = (
  customerPoint: CustomerPoint,
): string | null => {
  const data: Record<string, string | number> = {};
  let hasValues = false;
  for (const key of customerPoint.listProperties()) {
    if (!isCustomProperty(key)) continue;
    const value = customerPoint.getProperty(key);
    if (value === null || value === undefined) continue;
    data[key] = value as string | number;
    hasValues = true;
  }
  return hasValues ? JSON.stringify(data) : null;
};

export const applyCustomerPointCustomAttributes = (
  customerPoint: CustomerPoint,
  json: string | null,
): void => {
  if (json === null) return;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    throw new Error("Custom attributes: data is not valid JSON", {
      cause: error,
    });
  }
  const result = customAttributesDataSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Custom attributes: data does not match schema — ${result.error.message}`,
    );
  }
  for (const [key, value] of Object.entries(result.data)) {
    if (value === null) continue;
    customerPoint.setProperty(key, value);
  }
};
