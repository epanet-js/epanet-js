import type { MultiPolygon, Position } from "geojson";
import turfGetBbox from "@turf/bbox";
import type { ZoneData } from "@epanet-js/converters";
import { ZoneLabelGenerator, type ZoneId, type Zones } from "src/lib/zones";
import type { ImportZoneFeaturesResult, MergedZoneInfo } from "src/lib/zones";
import type { Placement } from "src/hooks/use-placement";

export const buildZones = (
  records: ZoneData[],
  placement: Placement,
): ImportZoneFeaturesResult => {
  const labelGenerator = new ZoneLabelGenerator();
  const grouped = new Map<
    string,
    { coordinates: Position[][][]; recordCount: number }
  >();

  for (const record of records) {
    const polygons = place(record.polygons, placement);
    const label = record.label ?? labelGenerator.next();
    const group = grouped.get(label);

    if (group) {
      group.coordinates.push(...polygons);
      group.recordCount += 1;
    } else {
      grouped.set(label, { coordinates: [...polygons], recordCount: 1 });
    }
  }

  const zones: Zones = new Map();
  const mergedZones: MergedZoneInfo[] = [];
  let id: ZoneId = 1;

  for (const [label, { coordinates, recordCount }] of grouped) {
    const geometry: MultiPolygon = { type: "MultiPolygon", coordinates };
    zones.set(id, { id, label, geometry, bbox: turfGetBbox(geometry) });

    if (recordCount > 1) mergedZones.push({ label, featureCount: recordCount });

    id++;
  }

  return { zones, mergedZones };
};

const place = (
  polygons: Position[][][],
  placement: Placement,
): Position[][][] => {
  if (placement.kind === "wgs84") return polygons;

  return polygons.map((polygon) =>
    polygon.map((ring) => ring.map(placement.toWgs84)),
  );
};
