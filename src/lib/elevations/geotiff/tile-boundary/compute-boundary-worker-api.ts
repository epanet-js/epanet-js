// eslint-disable-next-line no-restricted-imports
import proj4 from "proj4";
import { fromBlob } from "geotiff";
import simplify from "@turf/simplify";
import { polygon } from "@turf/helpers";
import { buildPixelTransformers } from "../pixel-transformer";

export const boundaryWorkerAPI = { computeDataBoundary };

export type BoundaryWorkerAPI = typeof boundaryWorkerAPI;

function isValidValue(val: number, noDataValue: number | null): boolean {
  if (val === undefined || val === null || isNaN(val)) return false;
  if (noDataValue !== null && val === noDataValue) return false;
  return true;
}

async function computeDataBoundary(
  file: File,
  width: number,
  height: number,
  noDataValue: number | null,
  pixelToCrs: number[],
  proj4Def?: string,
): Promise<GeoJSON.Geometry | null> {
  const tiff = await fromBlob(file);
  const image = await tiff.getImage();

  const maxRowSamples = 300;
  const rowStep = Math.max(1, Math.floor(height / maxRowSamples));

  const leftEdge: [number, number][] = [];
  const rightEdge: [number, number][] = [];

  const transformer = buildPixelTransformers({ pixelToCrs });

  for (let row = 0; row < height; row += rowStep) {
    const rasters = await image.readRasters({
      window: [0, row, width, row + 1],
    });
    const rowData = rasters[0] as Float32Array | Float64Array;

    let firstValid = -1;
    let lastValid = -1;

    for (let col = 0; col < width; col++) {
      if (isValidValue(rowData[col], noDataValue)) {
        firstValid = col;
        break;
      }
    }
    if (firstValid === -1) continue;

    for (let col = width - 1; col >= 0; col--) {
      if (isValidValue(rowData[col], noDataValue)) {
        lastValid = col;
        break;
      }
    }

    leftEdge.push(transformer.fromPixel(firstValid, row));
    rightEdge.push(transformer.fromPixel(lastValid, row));
  }

  if (leftEdge.length < 3) return null;

  rightEdge.reverse();
  let coords = [...leftEdge, ...rightEdge, leftEdge[0]];

  // Reproject from CRS to WGS84 if needed
  if (proj4Def) {
    coords = coords.map(
      (c) => proj4(proj4Def, "EPSG:4326", c) as [number, number],
    );
  }

  let result = polygon([coords]);
  try {
    result = simplify(result, { tolerance: 0.00005, highQuality: true });
  } catch {
    // keep unsimplified
  }

  return result.geometry;
}
