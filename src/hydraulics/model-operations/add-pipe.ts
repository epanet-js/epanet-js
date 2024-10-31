import { NodeAsset, Pipe, attachConnections } from "../assets";
import { ModelOperation } from "../model-operation";

type InputData = {
  pipe: Pipe;
  startNode: NodeAsset;
  endNode: NodeAsset;
};

export const addPipe: ModelOperation<InputData> = (
  hydraulicModel,
  { pipe, startNode, endNode },
) => {
  return {
    note: "Add pipe",
    putAssets: [
      startNode,
      attachConnections(pipe, startNode.id, endNode.id),
      endNode,
    ],
  };
};
