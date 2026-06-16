import type { Feature, Polygon, MultiPolygon } from "geojson";
import type { Zones } from "src/lib/zones";

export function buildZoneFeatures(
  zones: Zones,
): Feature<Polygon | MultiPolygon>[] {
  const features: Feature<Polygon | MultiPolygon>[] = [];

  for (const zone of zones.values()) {
    features.push({
      type: "Feature",
      geometry: zone.geometry,
      properties: {
        id: zone.id,
        label: zone.label,
      },
    });
  }

  return features;
}
