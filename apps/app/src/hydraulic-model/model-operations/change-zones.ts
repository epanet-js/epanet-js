import { Zones } from "@epanet-js/hydraulic-model";
import { ModelOperation } from "../model-operation";
import { changeSet, replaceZones } from "../change-sets";

type InputData = {
  zones: Zones;
};

export const changeZones: ModelOperation<InputData> = (model, { zones }) =>
  changeSet(model, "changeZones", [replaceZones(zones)]);
