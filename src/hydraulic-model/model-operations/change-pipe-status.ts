import { AssetId } from "../asset-types";
import { PipeStatus } from "../asset-types/pipe";
import { getPipe } from "../assets-map";
import { ModelOperation } from "../model-operation";

type InputData = {
  pipeId: AssetId;
  newStatus: PipeStatus;
};

export const changePipeStatus: ModelOperation<InputData> = (
  { assets },
  { pipeId, newStatus },
) => {
  const pipe = getPipe(assets, pipeId);
  if (!pipe) throw new Error("Invalid pipe id");

  const updatedPipe = pipe.copy();
  updatedPipe.setStatus(newStatus);
  return { note: "Change pipe status", putAssets: [updatedPipe] };
};
