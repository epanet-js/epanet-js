import { Position } from "geojson";
import { AssetId, NodeAsset, updateNodeCoordinates } from "../assets";
import { ModelOperation } from "../model-operation";

type InputData = {
  nodeId: AssetId;
  newCoordinates: Position;
};

export const moveNode: ModelOperation<InputData> = (
  { assets },
  { nodeId, newCoordinates },
) => {
  const node = assets.get(nodeId) as NodeAsset;

  const updatedNode = updateNodeCoordinates(node, newCoordinates);

  return { note: "Move node", putAssets: [updatedNode] };
};
