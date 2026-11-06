import type { HydraulicModel, ZoneId } from "@epanet-js/hydraulic-model";

export type ZoneRow = {
  id: ZoneId;
  label: string;
};

export function buildZoneModelRows(
  hydraulicModel: HydraulicModel,
  onlyIds?: ReadonlySet<number>,
): ZoneRow[] {
  const rows: ZoneRow[] = [];
  for (const zone of hydraulicModel.zones.values()) {
    if (onlyIds && !onlyIds.has(zone.id)) continue;
    rows.push(zone as unknown as ZoneRow);
  }
  return rows;
}
