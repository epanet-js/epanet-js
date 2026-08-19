import type { Converter, ParserResult } from "@epanet-js/converters";
import { registerConverter, type ConverterVendor } from "../registry";

export const stubConverter = (
  vendor: ConverterVendor,
  result: ParserResult,
  overrides: Partial<Converter> = {},
): Converter => {
  const converter: Converter = {
    name: "Stub",
    extensions: [".stub"],
    parseNetworkData: () => Promise.resolve(result),
    ...overrides,
  };
  registerConverter(vendor, converter);
  return converter;
};
