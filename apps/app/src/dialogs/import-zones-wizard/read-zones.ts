import type { Feature } from "geojson";
import type { Issue } from "@epanet-js/converters";
import type { Proj4Projection } from "@epanet-js/projections";
import { parseGisSource, zonesImporter } from "@epanet-js/gis-importers";
import type { GisFiles } from "src/components/gis-drop-zone";
import type { ReadZoneFeaturesResult, ZoneFeature } from "src/lib/zones";

type ReadOptions = {
  projections?: Map<string, Proj4Projection> | null;
};

export const readZonesWithImporter = async (
  gisFiles: GisFiles,
  { projections }: ReadOptions,
): Promise<ReadZoneFeaturesResult> => {
  const files = [
    gisFiles.geojson,
    gisFiles.dxf,
    gisFiles.shp,
    gisFiles.dbf,
    gisFiles.prj,
    gisFiles.cpg,
  ].filter((file): file is File => file != null);

  const source = { files, projections: projections ?? undefined };
  const { contents, sourceProjection, issues } =
    await zonesImporter.scanSource(source);

  const blocking = issues.find(({ severity }) => severity === "error");

  if (contents === null || blocking !== undefined) {
    return anError(errorFor(blocking));
  }

  const { features } = await parseGisSource(source);
  const polygons = features.filter(isPolygon);
  if (polygons.length === 0) return anError("noPolygons");

  const importableContents = contents.groups.find(
    ({ geometry }) => geometry === "polygon",
  );
  const attributes = importableContents?.attributes ?? [];

  const assumedCoordinateSystem = issues.some(
    ({ code }) => code === "coordinateSystemMissing",
  );

  return {
    features: polygons,
    uniqueProperties: new Set(attributes.map(({ name }) => name)),
    assumedCoordinateSystem,
    skippedRecordCount: contents.recordCount - polygons.length,
    ...(sourceProjection === undefined
      ? {}
      : {
          coordinateConversion: {
            detected: sourceProjection.name,
            converted: true,
            fromCRS: sourceProjection.name,
          },
        }),
  };
};

const errorFor = (
  issue: Issue | undefined,
): ReadZoneFeaturesResult["error"] => {
  switch (issue?.code) {
    case "coordinateSystemUnsupported":
    case "coordinateSystemMismatch":
      return "unsupportedProjection";
    case "coordinateSystemUnknown":
      return "invalidProjection";
    default:
      return "invalidFile";
  }
};

const anError = (
  error: ReadZoneFeaturesResult["error"],
): ReadZoneFeaturesResult => ({
  error,
  features: [],
  uniqueProperties: new Set<string>(),
});

const isPolygon = (feature: Feature): feature is ZoneFeature =>
  feature.geometry?.type === "Polygon" ||
  feature.geometry?.type === "MultiPolygon";
