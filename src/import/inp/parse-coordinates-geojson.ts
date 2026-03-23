import type { FeatureCollection, Feature, Position } from "geojson";

type LinkRef = { startNodeId: string; endNodeId: string };

export const parseCoordinatesGeoJson = (inp: string): FeatureCollection => {
  const coordinates = new Map<string, Position>();
  const vertices = new Map<string, Position[]>();
  const links = new Map<string, LinkRef>();

  const lines = inp.split("\n");
  let section: string | null = null;

  for (const line of lines) {
    const trimmed = line.replace(/;.*/, "").trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      section = trimmed.toUpperCase();
      continue;
    }

    const parts = trimmed.split(/\s+/);

    if (section === "[COORDINATES]" && parts.length >= 3) {
      coordinates.set(parts[0], [parseFloat(parts[1]), parseFloat(parts[2])]);
    } else if (section === "[VERTICES]" && parts.length >= 3) {
      const existing = vertices.get(parts[0]) ?? [];
      existing.push([parseFloat(parts[1]), parseFloat(parts[2])]);
      vertices.set(parts[0], existing);
    } else if (
      (section === "[PIPES]" || section === "[PUMPS]") &&
      parts.length >= 3
    ) {
      links.set(parts[0], {
        startNodeId: parts[1],
        endNodeId: parts[2],
      });
    } else if (section === "[VALVES]" && parts.length >= 3) {
      links.set(parts[0], {
        startNodeId: parts[1],
        endNodeId: parts[2],
      });
    }
  }

  const features: Feature[] = [];

  for (const [, coord] of coordinates) {
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: coord },
      properties: {},
    });
  }

  for (const [linkId, { startNodeId, endNodeId }] of links) {
    const start = coordinates.get(startNodeId);
    const end = coordinates.get(endNodeId);
    if (!start || !end) continue;

    const mid = vertices.get(linkId) ?? [];
    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [start, ...mid, end],
      },
      properties: {},
    });
  }

  return { type: "FeatureCollection", features };
};
