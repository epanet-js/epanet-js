import { Feature, FeatureCollection } from "geojson";
import bbox from "@turf/bbox";
import { AssetsMap } from "src/hydraulic-model";
import { padBBox } from "src/lib/geometry";

const METERS_PER_DEGREE = 111_320;
const CELL_SIZE_METERS = 100;
const CELL_SIZE_DEGREES = CELL_SIZE_METERS / METERS_PER_DEGREE;
const BUFFER_METERS = 10_000;
const BUFFER_DEGREES = BUFFER_METERS / METERS_PER_DEGREE;

export const buildGridSource = (assets: AssetsMap): Feature[] => {
  if (assets.size === 0) return [];

  const fc: FeatureCollection = {
    type: "FeatureCollection",
    features: [...assets.values()].map((a) => a.feature),
  };

  const [minX, minY, maxX, maxY] = padBBox(bbox(fc), BUFFER_DEGREES);

  const gridMinX = Math.floor(minX / CELL_SIZE_DEGREES) * CELL_SIZE_DEGREES;
  const gridMinY = Math.floor(minY / CELL_SIZE_DEGREES) * CELL_SIZE_DEGREES;
  const gridMaxX = Math.ceil(maxX / CELL_SIZE_DEGREES) * CELL_SIZE_DEGREES;
  const gridMaxY = Math.ceil(maxY / CELL_SIZE_DEGREES) * CELL_SIZE_DEGREES;

  const lines: Feature[] = [];

  for (let x = gridMinX; x <= gridMaxX; x += CELL_SIZE_DEGREES) {
    lines.push({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [x, gridMinY],
          [x, gridMaxY],
        ],
      },
    });
  }

  for (let y = gridMinY; y <= gridMaxY; y += CELL_SIZE_DEGREES) {
    lines.push({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [gridMinX, y],
          [gridMaxX, y],
        ],
      },
    });
  }

  return lines;
};
