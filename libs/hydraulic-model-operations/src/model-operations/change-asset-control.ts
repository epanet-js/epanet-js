import { AssetId, Control, setAssetControl } from "@epanet-js/hydraulic-model";
import { ModelOperation } from "../model-operation";
import { changeSet, replaceControls } from "../change-sets";

type InputData = {
  assetId: AssetId;
  control: Control | null;
};

export const changeAssetControl: ModelOperation<InputData> = (
  model,
  { assetId, control },
) =>
  changeSet(model, "changeAssetControl", [
    replaceControls(setAssetControl(model.controls, assetId, control)),
  ]);
