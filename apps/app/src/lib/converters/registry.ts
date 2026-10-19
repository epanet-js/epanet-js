import type { Converter } from "@epanet-js/converters";

export type ConverterVendor = "synergi";

export type RegisteredConverter = {
  vendor: ConverterVendor;
  converter: Converter;
};

export type ConverterSettings = {
  parseSelectionSets: boolean;
};

const converters = new Map<ConverterVendor, Converter>();

let applySettings: ((settings: ConverterSettings) => void) | null = null;

export const registerConverterSettings = (
  apply: (settings: ConverterSettings) => void,
): void => {
  applySettings = apply;
};

export const applyConverterSettings = (settings: ConverterSettings): void => {
  applySettings?.(settings);
};

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
