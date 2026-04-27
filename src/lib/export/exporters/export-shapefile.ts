import shpwrite from "@mapbox/shp-write";
import type { OGCGeometry } from "@mapbox/shp-write";
import type {
  FeatureCollection,
  LineString,
  MultiLineString,
  MultiPoint,
  MultiPolygon,
  Point,
  Polygon,
} from "geojson";
import { ExportedFile, ExportEntry } from "../types";
import { generateGeoJson } from "./generate-geojson";

const PRJ =
  'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["Degree",0.017453292519943295]]';

const MIME = "application/octet-stream";

type ShapefileLayer = {
  properties: object[];
  geometries: object[];
  type: OGCGeometry;
};

type ValidGeometries =
  | Point
  | MultiPoint
  | LineString
  | MultiLineString
  | Polygon
  | MultiPolygon;

function extractLayer(
  geoJson: FeatureCollection,
  geoJsonType: string,
  shpType: OGCGeometry,
): ShapefileLayer | null {
  const features = geoJson.features.filter(
    (f) => f.geometry?.type === geoJsonType,
  );
  if (features.length === 0) return null;

  const properties = features.map((f) => f.properties ?? {});
  const coords = features.map(
    (f) => (f.geometry as ValidGeometries).coordinates,
  );
  const geometries =
    shpType === "POLYLINE" || shpType === "POLYGON" ? [coords] : coords;

  return { properties, geometries, type: shpType };
}

function writeLayer(layer: ShapefileLayer): Promise<{
  shp: ArrayBuffer;
  shx: ArrayBuffer;
  dbf: { buffer: ArrayBuffer };
}> {
  return new Promise((resolve, reject) => {
    shpwrite.write(
      layer.properties,
      layer.type,
      layer.geometries,
      (err, files) => {
        if (err) reject(err);
        else
          resolve(
            files as {
              shp: ArrayBuffer;
              shx: ArrayBuffer;
              dbf: { buffer: ArrayBuffer };
            },
          );
      },
    );
  });
}

function toFiles(
  baseName: string,
  shp: ArrayBuffer,
  shx: ArrayBuffer,
  dbf: { buffer: ArrayBuffer },
): ExportedFile[] {
  return [
    {
      fileName: `${baseName}.shp`,
      extensions: [".shp"],
      mimeTypes: [MIME],
      description: "Shapefile",
      blob: new Blob([shp], { type: MIME }),
    },
    {
      fileName: `${baseName}.shx`,
      extensions: [".shx"],
      mimeTypes: [MIME],
      description: "Shapefile Index",
      blob: new Blob([shx], { type: MIME }),
    },
    {
      fileName: `${baseName}.dbf`,
      extensions: [".dbf"],
      mimeTypes: [MIME],
      description: "dBASE Table",
      blob: new Blob([dbf.buffer], { type: MIME }),
    },
    {
      fileName: `${baseName}.prj`,
      extensions: [".prj"],
      mimeTypes: ["text/plain"],
      description: "Projection",
      blob: new Blob([PRJ], { type: "text/plain" }),
    },
  ];
}

export const exportShapefile = async (
  entry: ExportEntry,
): Promise<ExportedFile[]> => {
  const geoJson = generateGeoJson(entry.data);

  const candidates: [string, OGCGeometry][] = [
    ["Point", "POINT"],
    ["MultiPoint", "MULTIPOINT"],
    ["LineString", "POLYLINE"],
    ["MultiLineString", "POLYLINE"],
    ["Polygon", "POLYGON"],
    ["MultiPolygon", "POLYGON"],
  ];

  const layers = candidates
    .map(([gjType, shpType]) => extractLayer(geoJson, gjType, shpType))
    .filter((l): l is ShapefileLayer => l !== null);

  const results: ExportedFile[] = [];

  for (const layer of layers) {
    const { shp, shx, dbf } = await writeLayer(layer);
    const baseName =
      layers.length > 1
        ? `${entry.name}.${layer.type.toLowerCase()}`
        : entry.name;
    results.push(...toFiles(baseName, shp, shx, dbf));
  }

  return results;
};
