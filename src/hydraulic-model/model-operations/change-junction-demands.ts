import { AssetId } from "../asset-types";
import { JunctionDemand } from "../demands";
import type { AssetPatch } from "../model-operation";
import { ModelOperation } from "../model-operation";

type InputData = {
  junctionId: AssetId;
  demands: JunctionDemand[];
};

export const changeJunctionDemands: ModelOperation<InputData> = (
  { assets },
  { junctionId, demands },
) => {
  const junction = assets.get(junctionId);
  if (!junction) throw new Error(`Invalid junction id ${junctionId}`);
  if (junction.type !== "junction") {
    throw new Error(`Asset ${junctionId} is not a junction`);
  }

  return {
    note: "Change junction demands",
    patchAssetsAttributes: [
      {
        id: junctionId,
        type: "junction",
        properties: { demands },
      } as AssetPatch,
    ],
  };
};
