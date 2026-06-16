import type { MultiPolygon, Position } from "geojson";
import turfGetBbox from "@turf/bbox";
import type { Zones, ZoneId } from "./zones";
import type { ZoneFeature } from "./read-zone-features";
import { ZoneLabelGenerator } from "./zone-label-generator";

export type MergedZoneInfo = {
  label: string;
  featureCount: number;
};

export type ImportZoneFeaturesResult = {
  zones: Zones;
  mergedZones: MergedZoneInfo[];
};

export const importZoneFeatures = (
  features: ZoneFeature[],
  labelProperty?: string,
): ImportZoneFeaturesResult => {
  const zones: Zones = new Map();
  const mergedZones: MergedZoneInfo[] = [];
  const labelGenerator = new ZoneLabelGenerator();

  if (!labelProperty) {
    features.forEach((feature, index) => {
      const id: ZoneId = index + 1;
      const label = labelGenerator.next();
      const geometry = toMultiPolygon(feature);
      const bbox = turfGetBbox(geometry);
      zones.set(id, { id, label, geometry, bbox });
    });
  } else {
    const groups = new Map<string, ZoneFeature[]>();

    for (const feature of features) {
      const label = feature.properties?.[labelProperty];
      const key =
        label === null || label === undefined
          ? labelGenerator.next()
          : String(label);

      const group = groups.get(key);
      if (group) {
        group.push(feature);
      } else {
        groups.set(key, [feature]);
      }
    }

    let id: ZoneId = 1;
    for (const [label, groupFeatures] of groups) {
      const coordinates: Position[][][] = [];

      for (const feature of groupFeatures) {
        const multi = toMultiPolygon(feature);
        coordinates.push(...multi.coordinates);
      }

      const geometry: MultiPolygon = {
        type: "MultiPolygon",
        coordinates,
      };
      const bbox = turfGetBbox(geometry);
      zones.set(id, { id, label, geometry, bbox });

      if (groupFeatures.length > 1) {
        mergedZones.push({ label, featureCount: groupFeatures.length });
      }

      id++;
    }
  }

  return { zones, mergedZones };
};

const toMultiPolygon = (feature: ZoneFeature): MultiPolygon =>
  feature.geometry.type === "Polygon"
    ? { type: "MultiPolygon", coordinates: [feature.geometry.coordinates] }
    : feature.geometry;
