import { CRS_UNIT_TO_APP_UNIT } from "./spec";
import { GeoTiffTile } from "./types";

export function tileCoverage(
  tile: GeoTiffTile,
  {
    isFilled,
    isDisabled,
    showLabel,
  }: { isFilled: boolean; isDisabled: boolean; showLabel: boolean },
): GeoJSON.Feature {
  const geometry: GeoJSON.Geometry =
    tile.coveragePolygon ?? bboxToPolygon(tile.bbox);
  return {
    type: "Feature",
    properties: {
      id: tile.id,
      isFilled,
      isDisabled,
      ...(showLabel && { label: tile.file.name }),
    },
    geometry,
  };
}

function bboxToPolygon(
  bbox: [number, number, number, number],
): GeoJSON.Polygon {
  const [west, south, east, north] = bbox;
  return {
    type: "Polygon",
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  };
}

export function tileResolution(tile: GeoTiffTile): {
  value: number;
  unit: "m" | "ft";
} {
  const scale = tile.resolution[0];

  // Projected CRS: resolution is in CRS linear units (meters, feet, etc.)
  if (tile.crsUnit !== "deg") {
    const sourceUnit = CRS_UNIT_TO_APP_UNIT[tile.crsUnit];
    return { value: scale, unit: sourceUnit };
  }

  // Geographic CRS: resolution is in degrees, approximate conversion
  const centerLat = (tile.bbox[1] + tile.bbox[3]) / 2;
  const scaleInMeters = scale * 111_320 * Math.cos((centerLat * Math.PI) / 180);
  return { value: scaleInMeters, unit: "m" };
}
