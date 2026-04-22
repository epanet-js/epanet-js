import { FeatureCollection } from "geojson";
import shp from "shpjs";
import { isLikelyLatLng } from "src/lib/geojson-utils/coordinate-transform";
import { GisParseError, type GisParseResult } from "./types";

function findByExtension(files: File[], ext: string): File | undefined {
  return files.find((f) => f.name.toLowerCase().endsWith(ext));
}

export async function parseShapefile(files: File[]): Promise<GisParseResult> {
  const shpFile = findByExtension(files, ".shp");
  if (!shpFile) {
    throw new GisParseError(files[0]?.name ?? "unknown", "invalid-format");
  }

  const dbfFile = findByExtension(files, ".dbf");
  const prjFile = findByExtension(files, ".prj");
  const cpgFile = findByExtension(files, ".cpg");

  const input: {
    shp: ArrayBuffer;
    dbf?: ArrayBuffer;
    prj?: string;
    cpg?: string;
  } = {
    shp: await shpFile.arrayBuffer(),
  };
  if (dbfFile) input.dbf = await dbfFile.arrayBuffer();
  if (prjFile) input.prj = await prjFile.text();
  if (cpgFile) input.cpg = await cpgFile.text();

  let featureCollection: FeatureCollection;
  try {
    const result = await shp(input);
    featureCollection = result;
  } catch {
    throw new GisParseError(shpFile.name, "invalid-format");
  }

  if (!featureCollection.features || featureCollection.features.length === 0) {
    throw new GisParseError(shpFile.name, "no-features");
  }

  // When no .prj is provided, shpjs does not reproject. Reject if coordinates
  // are clearly not WGS84. (Note: features with null geometry will cause this
  // check to return false, so an all-null-geometry file without .prj will get
  // missing-projection rather than no-features — acceptable edge case.)
  if (!prjFile && !isLikelyLatLng(featureCollection)) {
    throw new GisParseError(shpFile.name, "missing-projection");
  }

  const name = shpFile.name.replace(/\.shp$/i, "");
  const properties = Object.keys(
    featureCollection.features[0]?.properties ?? {},
  );
  return { featureCollection, name, properties };
}
