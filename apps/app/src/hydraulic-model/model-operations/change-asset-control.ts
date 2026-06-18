import { AssetId, Control, setAssetControl } from "@epanet-js/hydraulic-model";
import { ModelOperation } from "../model-operation";

export const changeAssetControl: ModelOperation<{
  assetId: AssetId;
  control: Control | null;
}> = (hydraulicModel, { assetId, control }) => {
  return {
    note: "Change controls",
    putControls: setAssetControl(hydraulicModel.controls, assetId, control),
  };
};
