import type { ModelFactories, Zone, Zones } from "@epanet-js/hydraulic-model";
import {
  parseRows,
  zoneBboxSchema,
  zoneGeometrySchema,
  zoneRowSchema,
  type ZoneRow,
} from "@epanet-js/ejsdb";
import { applyZoneCustomAttributes } from "./custom-attributes";

export const buildZonesData = (
  rawRows: unknown[],
  factories: ModelFactories,
): Zones => {
  const rows = parseRows(zoneRowSchema, rawRows, "Zone");
  const zones: Zones = new Map();
  for (const row of rows) {
    const zone = factories.zoneFactory.load({
      id: row.id,
      label: row.label,
      geometry: parseGeometry(row),
      bbox: parseBbox(row),
    });
    applyZoneCustomAttributes(zone, row.custom_attributes);
    zones.set(zone.id, zone);
  }
  return zones;
};

const parseJson = (row: ZoneRow, field: "geometry" | "bbox"): unknown => {
  try {
    return JSON.parse(row[field]);
  } catch (error) {
    throw new Error(
      `Zone ${row.id} (${row.label}): ${field} is not valid JSON`,
      { cause: error },
    );
  }
};

const parseGeometry = (row: ZoneRow): Zone["geometry"] => {
  const result = zoneGeometrySchema.safeParse(parseJson(row, "geometry"));
  if (!result.success) {
    throw new Error(
      `Zone ${row.id} (${row.label}): geometry must be a MultiPolygon of finite-number positions — ${result.error.message}`,
    );
  }
  return result.data as Zone["geometry"];
};

const parseBbox = (row: ZoneRow): Zone["bbox"] => {
  const result = zoneBboxSchema.safeParse(parseJson(row, "bbox"));
  if (!result.success) {
    throw new Error(
      `Zone ${row.id} (${row.label}): bbox must be an array of finite numbers — ${result.error.message}`,
    );
  }
  return result.data as Zone["bbox"];
};
