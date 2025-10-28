import { Position } from "geojson";
import { AssetId } from "../asset-types";
import { ModelOperation } from "../model-operation";
import { moveNode as moveNodeNew } from "./move-node-new";

type InputData = {
  nodeId: AssetId;
  newCoordinates: Position;
  newElevation: number;
  shouldUpdateCustomerPoints?: boolean;
  pipeIdToSplit?: AssetId;
  enableVertexSnap?: boolean;
};

export const moveNode: ModelOperation<InputData> = (
  hydraulicModel,
  inputData,
) => {
  return moveNodeNew(hydraulicModel, inputData);
};
