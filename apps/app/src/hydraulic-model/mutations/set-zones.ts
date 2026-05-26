import { HydraulicModel } from "src/hydraulic-model/hydraulic-model";
import { Zone } from "src/hydraulic-model/zones";

export const setZones = (
  hydraulicModel: HydraulicModel,
  zonesToSet: Zone[],
): HydraulicModel => {
  const updatedZones = new Map<number, Zone>();

  for (const zone of zonesToSet) {
    updatedZones.set(zone.id, zone);
  }

  return {
    ...hydraulicModel,
    zones: updatedZones,
  };
};
