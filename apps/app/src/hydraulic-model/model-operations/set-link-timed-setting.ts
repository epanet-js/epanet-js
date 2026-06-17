import {
  AssetId,
  TimedSettingStep,
  setLinkTimedSetting as setLinkTimedSettingControl,
} from "@epanet-js/hydraulic-model";
import { ModelOperation } from "../model-operation";

export const setLinkTimedSetting: ModelOperation<{
  linkId: AssetId;
  steps: TimedSettingStep[] | null;
}> = (hydraulicModel, { linkId, steps }) => {
  return {
    note: "Change controls",
    putControls: setLinkTimedSettingControl(
      hydraulicModel.controls,
      linkId,
      steps,
    ),
  };
};
