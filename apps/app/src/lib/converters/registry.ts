import type { Converter } from "@epanet-js/converters";

export type ConverterVendor = "synergi";

export type RegisteredConverter = {
  vendor: ConverterVendor;
  converter: Converter;
};

const converters = new Map<ConverterVendor, Converter>();

export const registerConverter = (
  vendor: ConverterVendor,
  converter: Converter,
): void => {
  converters.set(vendor, converter);
};

export const getConverter = (vendor: ConverterVendor): Converter | null =>
  converters.get(vendor) ?? null;

export const listConverters = (): RegisteredConverter[] =>
  [...converters.entries()].map(([vendor, converter]) => ({
    vendor,
    converter,
  }));

export const converterExtensions = (entries: RegisteredConverter[]): string[] =>
  entries.flatMap(({ converter }) => converter.extensions);

export const converterForFile = (
  entries: RegisteredConverter[],
  fileName: string,
): RegisteredConverter | null => {
  const name = fileName.toLowerCase();
  return (
    entries.find(({ converter }) =>
      converter.extensions.some((extension) =>
        name.endsWith(extension.toLowerCase()),
      ),
    ) ?? null
  );
};
