import type { MultiPolygon } from "geojson";
import turfGetBbox from "@turf/bbox";
import type { Zones, ZoneId } from "./zones";
import type { ZoneFeature } from "./read-zone-features";
import { ZoneLabelGenerator } from "./zone-label-generator";
import { computeAdjacency } from "./zone-adjacency";

export const importZoneFeatures = (
  features: ZoneFeature[],
  labelProperty?: string,
): Zones => {
  const zones: Zones = {};
  const labelGenerator = new ZoneLabelGenerator();

  features.forEach((feature, index) => {
    const id: ZoneId = index + 1;
    const label = labelProperty
      ? String(feature.properties?.[labelProperty] ?? labelGenerator.next())
      : labelGenerator.next();

    const geometry: MultiPolygon =
      feature.geometry.type === "Polygon"
        ? { type: "MultiPolygon", coordinates: [feature.geometry.coordinates] }
        : feature.geometry;

    const bbox = turfGetBbox(geometry);
    zones[id] = { id, label, geometry, bbox, adjacentZones: [] };
  });

  const adjacency = computeAdjacency(zones);
  for (const [id, neighbors] of adjacency) {
    zones[id].adjacentZones = neighbors;
  }

  return zones;
};
