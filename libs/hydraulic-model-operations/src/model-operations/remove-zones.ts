import type { ZoneId } from "@epanet-js/hydraulic-model";
import { ModelOperation } from "../model-operation";
import { changeSet, dropZones } from "../change-sets";

type InputData = {
  zoneIds: readonly ZoneId[];
};

export const removeZones: ModelOperation<InputData> = (model, { zoneIds }) => {
  for (const zoneId of zoneIds) {
    if (!model.zones.has(zoneId)) throw new Error(`Zone ${zoneId} not found`);
  }

  return changeSet(model, "removeZones", [dropZones(zoneIds)]);
};
