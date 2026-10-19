import { AssetId, NodeAsset, Valve } from "../asset-types";
import { AssetsMap } from "../assets-map";

export const pickTargetNodeOptions = (
  assets: AssetsMap,
  valve: Valve,
  tracedIds: Iterable<AssetId>,
): NodeAsset[] => {
  const endNodeId = valve.connections[1];
  const options: NodeAsset[] = [];
  const currentTargetId = valve.targetNodeId;
  let currentTargetIsOffered = false;

  for (const id of tracedIds) {
    if (id === endNodeId) continue;
    const asset = assets.get(id);
    if (!asset?.isNode) continue;
    options.push(asset as NodeAsset);
    if (asset.id === currentTargetId) currentTargetIsOffered = true;
  }

  if (
    currentTargetId !== undefined &&
    currentTargetId !== endNodeId &&
    !currentTargetIsOffered
  ) {
    const target = assets.get(currentTargetId);
    if (target?.isNode) {
      options.push(target as NodeAsset);
    }
  }

  return options;
};
