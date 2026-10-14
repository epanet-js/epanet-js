import { AssetId } from "@epanet-js/hydraulic-model";
import { ModelOperation } from "../model-operation";
import { changeSet, setAsset } from "../change-sets";

export type NodeElevation = {
  nodeId: AssetId;
  elevation: number;
};

type InputData = {
  nodeElevations: NodeElevation[];
};

export const changeElevations: ModelOperation<InputData> = (
  model,
  { nodeElevations },
) =>
  changeSet(
    model,
    "changeElevations",
    nodeElevations.map(({ nodeId, elevation }) =>
      setAsset(nodeId, { elevation }),
    ),
  );
