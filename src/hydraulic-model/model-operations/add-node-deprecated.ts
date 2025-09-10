import { NodeAsset } from "../asset-types";
import { ModelOperation } from "../model-operation";
import { LabelGenerator } from "../label-manager";

type InputData = {
  node: NodeAsset;
};

export const addNodeDeprecated: ModelOperation<InputData> = (
  hydraulicModel,
  { node },
) => {
  const nodeCopy = node.copy();
  addMissingLabel(hydraulicModel.labelManager, nodeCopy);

  return {
    note: `Add ${node.type}`,
    putAssets: [nodeCopy],
  };
};

const addMissingLabel = (labelGenerator: LabelGenerator, node: NodeAsset) => {
  if (node.label === "") {
    node.setProperty("label", labelGenerator.generateFor(node.type, node.id));
  }
};
