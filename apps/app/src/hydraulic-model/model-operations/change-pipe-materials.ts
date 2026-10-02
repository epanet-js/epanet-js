import { AssetId, PipeMaterial } from "@epanet-js/hydraulic-model";
import { ModelOperation, ModelOperationDeprecated } from "../model-operation";
import { changeSet, setAsset, setPipeLibrary } from "../change-sets";

type MaterialAssignment = {
  assetIds: AssetId[];
  material: string;
};

type InputData = {
  pipeMaterials: PipeMaterial[];
  materialAssignments: MaterialAssignment[];
};

export const changePipeMaterials: ModelOperation<InputData> = (
  model,
  { pipeMaterials, materialAssignments },
) =>
  changeSet(model, "changePipeMaterials", [
    setPipeLibrary(pipeMaterials),
    ...materialAssignments.map(({ assetIds, material }) =>
      setAsset(assetIds, { material }),
    ),
  ]);

export const changePipeMaterialsDeprecated: ModelOperationDeprecated<
  PipeMaterial[]
> = (_model, pipeMaterials) => {
  return {
    note: "changePipeMaterials",
    putPipeMaterials: pipeMaterials,
  };
};
