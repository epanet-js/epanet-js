import type { ParseNetworkData } from "@epanet-js/converters";

export type ConverterVendor = "synergi";

const converters = new Map<ConverterVendor, ParseNetworkData>();

export const registerConverter = (
  vendor: ConverterVendor,
  parse: ParseNetworkData,
): void => {
  converters.set(vendor, parse);
};

export const getConverter = (
  vendor: ConverterVendor,
): ParseNetworkData | null => converters.get(vendor) ?? null;
