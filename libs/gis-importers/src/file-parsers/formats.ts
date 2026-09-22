type GisFormatId = "geojson" | "geojsonl" | "shapefile" | "dxf";

export type GisFormat = {
  id: GisFormatId;
  primaryExtensions: string[];
  sidecarExtensions: string[];
  auxiliaryExtensions: string[];
};

const gisFormats: readonly GisFormat[] = [
  {
    id: "geojson",
    primaryExtensions: [".geojson", ".json"],
    sidecarExtensions: [],
    auxiliaryExtensions: [],
  },
  {
    id: "geojsonl",
    primaryExtensions: [".geojsonl"],
    sidecarExtensions: [],
    auxiliaryExtensions: [],
  },
  {
    id: "dxf",
    primaryExtensions: [".dxf"],
    sidecarExtensions: [],
    auxiliaryExtensions: [],
  },
  {
    id: "shapefile",
    primaryExtensions: [".shp"],
    sidecarExtensions: [".dbf", ".prj", ".cpg"],
    auxiliaryExtensions: [
      ".shx",
      ".qix",
      ".sbn",
      ".sbx",
      ".atx",
      ".aih",
      ".ain",
      ".qmd",
      ".qml",
      ".lyr",
      ".xml",
    ],
  },
];

const named = (name: string, extension: string): boolean =>
  name.toLowerCase().endsWith(extension);

export const gisFormatOf = (name: string): GisFormat | null =>
  gisFormats.find((format) =>
    format.primaryExtensions.some((extension) => named(name, extension)),
  ) ?? null;

export const isGisSecondaryPart = (name: string): boolean =>
  gisFormats.some((format) =>
    [...format.sidecarExtensions, ...format.auxiliaryExtensions].some(
      (extension) => named(name, extension),
    ),
  );

export const isGisAuxiliaryFile = (name: string): boolean =>
  gisFormats.some((format) =>
    format.auxiliaryExtensions.some((extension) => named(name, extension)),
  );

export const gisSourceExtensions: readonly string[] = gisFormats.flatMap(
  (format) => [...format.primaryExtensions, ...format.sidecarExtensions],
);
