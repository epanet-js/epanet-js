import type { MultiPolygon } from "geojson";
import type { Zones, ZoneId } from "./zones";
import type { ZoneFeature } from "./read-zone-features";
import { ZoneLabelGenerator } from "./zone-label-generator";

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

    zones[id] = { id, label, geometry };
  });

  return zones;
};
