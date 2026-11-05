import type { ZoneId } from "@epanet-js/hydraulic-model";
import type { ChangeSet } from "@epanet-js/change-set";
import { HydraulicModel } from "@epanet-js/hydraulic-model";
import { changeSet, setZone, type Fields } from "../change-sets";

type ChangeZonePropertyData = {
  zoneIds: ZoneId[];
  property: string;
  value: unknown;
};

export function changeZoneProperty(
  model: HydraulicModel,
  { zoneIds, property, value }: ChangeZonePropertyData,
): ChangeSet {
  for (const zoneId of zoneIds) {
    if (!model.zones.has(zoneId)) throw new Error(`Zone ${zoneId} not found`);
  }

  return changeSet(model, "changeZoneProperty", [
    setZone(zoneIds, { [property]: value } as Fields),
  ]);
}
