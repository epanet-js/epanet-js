import type { ParseNetworkData, ParserResult } from "@epanet-js/converters";
import { registerConverter, type ConverterVendor } from "../registry";

export const stubConverter = (
  vendor: ConverterVendor,
  result: ParserResult,
): ParseNetworkData => {
  const parse: ParseNetworkData = () => Promise.resolve(result);
  registerConverter(vendor, parse);
  return parse;
};
