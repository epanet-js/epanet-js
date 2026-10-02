import type { Zone, Zones } from "@epanet-js/hydraulic-model";
import {
  zoneBboxSchema,
  zoneGeometrySchema,
  zoneRowSchema,
  type ZoneRow,
} from "@epanet-js/ejsdb";

export const toZoneRow = (zone: Zone): ZoneRow => {
  const geometryResult = zoneGeometrySchema.safeParse(zone.geometry);
  if (!geometryResult.success) {
    throw new Error(
      `Zone ${zone.id} (${zone.label}): geometry must be a MultiPolygon of finite-number positions — ${geometryResult.error.message}`,
    );
  }
  const bboxResult = zoneBboxSchema.safeParse(zone.bbox);
  if (!bboxResult.success) {
    throw new Error(
      `Zone ${zone.id} (${zone.label}): bbox must be an array of finite numbers — ${bboxResult.error.message}`,
    );
  }
  const candidate = {
    id: zone.id,
    label: zone.label,
    geometry: JSON.stringify(geometryResult.data),
    bbox: JSON.stringify(bboxResult.data),
  };
  const rowResult = zoneRowSchema.safeParse(candidate);
  if (!rowResult.success) {
    throw new Error(
      `Zone ${zone.id} (${zone.label}): row does not match schema — ${rowResult.error.message}`,
    );
  }
  return rowResult.data;
};

export const zonesToRows = (zones: Zones): ZoneRow[] => {
  const rows: ZoneRow[] = [];
  for (const zone of zones.values()) {
    rows.push(toZoneRow(zone));
  }
  return rows;
};
