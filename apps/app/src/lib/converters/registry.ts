import type { Converter } from "@epanet-js/converters";

export type ConverterVendor = "synergi";

const converters = new Map<ConverterVendor, Converter>();

export const registerConverter = (
  vendor: ConverterVendor,
  converter: Converter,
): void => {
  converters.set(vendor, converter);
};

export const getConverter = (vendor: ConverterVendor): Converter | null =>
  converters.get(vendor) ?? null;
