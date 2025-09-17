import { Position } from "geojson";
import { AssetId } from "../asset-types";
import { ModelOperation } from "../model-operation";
import { moveNode as moveNodeNew } from "./move-node-new";
import { moveNodeDeprecated } from "./move-node-deprecated";

type InputData = {
  nodeId: AssetId;
  newCoordinates: Position;
  newElevation: number;
  shouldUpdateCustomerPoints?: boolean;
  pipeIdToSplit?: AssetId;
};

export const moveNode: ModelOperation<InputData> = (
  hydraulicModel,
  inputData,
) => {
  if (typeof window !== "undefined") {
    const urlParams = new URLSearchParams(window.location.search);
    const isSnappingOn = urlParams.get("FLAG_SNAPPING") === "true";

    if (isSnappingOn) {
      return moveNodeNew(hydraulicModel, inputData);
    }
  }

  return moveNodeDeprecated(hydraulicModel, inputData);
};
