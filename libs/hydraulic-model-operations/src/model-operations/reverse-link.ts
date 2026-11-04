import {
  AssetId,
  Controls,
  FlowModulatingValveControl,
  LinkAsset,
  getLinkFlowModulatingValve,
  setAssetControl,
} from "@epanet-js/hydraulic-model";
import { ModelOperation } from "../model-operation";
import { HydraulicModel } from "@epanet-js/hydraulic-model";
import { changeSet, putAssets, replaceControls } from "../change-sets";

type ReverseLinkData = {
  linkId: AssetId;
};

export const reverseLink: ModelOperation<ReverseLinkData> = (
  hydraulicModel,
  { linkId },
) => {
  const linkCopy = buildReversedLink(hydraulicModel, linkId);
  const controls = resetFlowModulatingControl(hydraulicModel, linkCopy);

  return changeSet(hydraulicModel, "reverseLink", [
    putAssets([linkCopy]),
    ...(controls ? [replaceControls(controls)] : []),
  ]);
};

const buildReversedLink = (
  hydraulicModel: HydraulicModel,
  linkId: AssetId,
): LinkAsset => {
  const asset = hydraulicModel.assets.get(linkId);
  if (!asset || asset.isNode) {
    throw new Error(`Link with id ${linkId} not found`);
  }

  const linkAsset = asset as LinkAsset;
  const linkCopy = linkAsset.copy() as LinkAsset;

  const [startNodeId, endNodeId] = linkCopy.connections;
  linkCopy.setConnections(endNodeId, startNodeId);

  const reversedCoordinates = [...linkCopy.coordinates].reverse();
  linkCopy.setCoordinates(reversedCoordinates);

  return linkCopy;
};

const resetFlowModulatingControl = (
  hydraulicModel: HydraulicModel,
  reversedLink: LinkAsset,
): Controls | null => {
  const control = getLinkFlowModulatingValve(
    hydraulicModel.controls,
    reversedLink.id,
  );
  if (!control) return null;

  const outletNodeId = reversedLink.connections[1];
  if (
    control.sensorLinkId === reversedLink.id &&
    control.controlNodeId === outletNodeId
  ) {
    return null;
  }

  const reset: FlowModulatingValveControl = {
    ...control,
    sensorLinkId: reversedLink.id,
    controlNodeId: outletNodeId,
  };
  return setAssetControl(hydraulicModel.controls, reversedLink.id, reset);
};
