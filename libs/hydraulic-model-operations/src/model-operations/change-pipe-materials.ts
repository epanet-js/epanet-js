import {
  AssetId,
  HydraulicModel,
  PipeMaterial,
  pipeMaterialKey,
} from "@epanet-js/hydraulic-model";
import { ModelOperation } from "../model-operation";
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
) => {
  checkNewLabels(model, pipeMaterials);
  return changeSet(model, "changePipeMaterials", [
    setPipeLibrary(pipeMaterials),
    ...materialAssignments.map(({ assetIds, material }) =>
      setAsset(assetIds, { material }),
    ),
  ]);
};

const checkNewLabels = (
  model: HydraulicModel,
  pipeMaterials: PipeMaterial[],
) => {
  const currentLabels = new Set(model.pipeMaterials.map(({ label }) => label));
  for (const material of pipeMaterials) {
    if (currentLabels.has(material.label)) continue;
    if (material.label === "") {
      throw new Error("Cannot add a pipe material without a name");
    }
    const key = pipeMaterialKey(material.label);
    const clash = pipeMaterials.find(
      (other) => other !== material && pipeMaterialKey(other.label) === key,
    );
    if (clash) {
      throw new Error(
        `Cannot add pipe material ${material.label}; ${clash.label} already has that name`,
      );
    }
  }
};
