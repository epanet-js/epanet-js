import { AssetId } from "../asset-types";
import { PipeStatus } from "../asset-types/pipe";
import { getPipe } from "../assets-map";
import { ModelOperation } from "../model-operation";

type InputData = {
  pipeId: AssetId;
  newInitialStatus: PipeStatus;
};

export const changePipeStatus: ModelOperation<InputData> = (
  { assets },
  { pipeId, newInitialStatus },
) => {
  const pipe = getPipe(assets, pipeId);
  if (!pipe) throw new Error("Invalid pipe id");

  const updatedPipe = pipe.copy();
  updatedPipe.setInitialStatus(newInitialStatus);
  return { note: "Change pipe initial status", putAssets: [updatedPipe] };
};
