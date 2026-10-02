import { AssetId } from "@epanet-js/hydraulic-model";
import type { AssetPatch } from "../model-operation";
import { ModelOperation, ModelOperationDeprecated } from "../model-operation";
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

export const changeElevationsDeprecated: ModelOperationDeprecated<InputData> = (
  { assets },
  { nodeElevations },
) => ({
  note: "changeElevations",
  patchAssetsAttributes: nodeElevations.map(
    ({ nodeId, elevation }) =>
      ({
        id: nodeId,
        type: assets.get(nodeId)!.type,
        properties: { elevation },
      }) as AssetPatch,
  ),
});
