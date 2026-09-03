import type { ChangeSet } from "@epanet-js/change-set";
import type { HydraulicModel } from "../hydraulic-model";
import type { ModelMoment } from "../model-operation";
import { changeSet, type Intent } from "./build";
import type { Fields } from "./entities";
import {
  dropAssets,
  dropCustomerPoints,
  putAssets,
  putCustomerPoints,
  replaceControls,
  replaceCurves,
  replaceCustomAttributes,
  replacePatterns,
  setAsset,
  setCustomerPoint,
  setDemands,
  setPipeLibrary,
  setRawControls,
} from "./intents";

export const toChangeSet = (
  model: HydraulicModel,
  moment: ModelMoment,
): ChangeSet => {
  const intents: Intent[] = [];

  if (moment.putPipeMaterials) {
    intents.push(setPipeLibrary(moment.putPipeMaterials));
  }
  if (moment.putRawControls) {
    intents.push(setRawControls(moment.putRawControls));
  }
  if (moment.putControls) intents.push(replaceControls(moment.putControls));
  if (moment.putCurves) intents.push(replaceCurves(moment.putCurves));
  if (moment.putPatterns) intents.push(replacePatterns(moment.putPatterns));
  if (moment.putCustomAttributesDefinition) {
    intents.push(replaceCustomAttributes(moment.putCustomAttributesDefinition));
  }

  if (moment.deleteAssets) intents.push(dropAssets(moment.deleteAssets));
  if (moment.putAssets) intents.push(putAssets(moment.putAssets));
  for (const patch of moment.patchAssetsAttributes ?? []) {
    intents.push(setAsset(patch.id, patch.properties as Fields));
  }

  if (moment.putCustomerPoints) {
    intents.push(putCustomerPoints(moment.putCustomerPoints));
  }
  if (moment.deleteCustomerPoints) {
    intents.push(dropCustomerPoints(moment.deleteCustomerPoints));
  }
  for (const patch of moment.patchCustomerPointsAttributes ?? []) {
    intents.push(setCustomerPoint(patch.id, patch.properties as Fields));
  }

  if (moment.putDemands?.assignments) {
    intents.push(setDemands(moment.putDemands.assignments));
  }

  return changeSet(model, moment.note, intents);
};
