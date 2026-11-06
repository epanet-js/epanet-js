import type { ZoneId } from "@epanet-js/hydraulic-model";
import type { ChangeSet } from "@epanet-js/change-set";
import { HydraulicModel } from "@epanet-js/hydraulic-model";
import { changeSet, setZone, type Fields } from "../change-sets";

type ZonePropertyChange = {
  property: string;
  value: unknown;
};

type ChangeZonePropertyData = {
  zoneIds: ZoneId[];
  property: string;
  value: unknown;
};

type ChangeZonePropertiesData = {
  zoneIds: ZoneId[];
  changes: ZonePropertyChange[];
};

export function changeZoneProperty(
  model: HydraulicModel,
  { zoneIds, property, value }: ChangeZonePropertyData,
): ChangeSet {
  assertZonesExist(model, zoneIds);

  return changeSet(model, "changeZoneProperty", [
    setZone(zoneIds, { [property]: value } as Fields),
  ]);
}

export function changeZoneProperties(
  model: HydraulicModel,
  { zoneIds, changes }: ChangeZonePropertiesData,
): ChangeSet {
  assertZonesExist(model, zoneIds);

  const fields: Fields = {};
  for (const { property, value } of changes) {
    fields[property] = value as Fields[string];
  }

  return changeSet(model, "changeZoneProperties", [setZone(zoneIds, fields)]);
}

function assertZonesExist(model: HydraulicModel, zoneIds: ZoneId[]) {
  for (const zoneId of zoneIds) {
    if (!model.zones.has(zoneId)) throw new Error(`Zone ${zoneId} not found`);
  }
}
