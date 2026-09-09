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
    gisFiles.shp,
    gisFiles.dbf,
    gisFiles.prj,
    gisFiles.cpg,
  ].filter((file): file is File => file != null);

  const source = { files, projections: projections ?? undefined };
  const { summary, issues } = await zonesImporter.scanSource(source);

  const blocking = issues.find(({ severity }) => severity === "error");

  if (summary === null || blocking !== undefined) {
    return anError(errorFor(blocking));
  }

  const { features } = await parseGisSource(source);
  const polygons = features.filter(isPolygon);
  if (polygons.length === 0) return anError("noPolygons");

  const { originalProjection } = summary;

  return {
    features: polygons,
    uniqueProperties: new Set(summary.attributes.map(({ name }) => name)),
    ...(originalProjection === undefined
      ? {}
      : {
          coordinateConversion: {
            detected: originalProjection,
            converted: true,
            fromCRS: originalProjection,
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
