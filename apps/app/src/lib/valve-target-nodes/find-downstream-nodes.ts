import { NodeAsset, Valve } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model/hydraulic-model";
import { runTrace } from "src/lib/trace";

export const findDownstreamNodes = async (
  hydraulicModel: HydraulicModel,
  valve: Valve,
  signal?: AbortSignal,
): Promise<NodeAsset[]> => {
  const endNodeId = valve.connections[1];
  if (endNodeId === undefined) return [];

  const traced = await runTrace(
    hydraulicModel,
    null,
    { mode: "boundary", startNodeIds: [endNodeId], startLinkIds: [] },
    signal,
  );

  const nodes: NodeAsset[] = [];
  for (const id of traced) {
    if (id === endNodeId) continue;
    const asset = hydraulicModel.assets.get(id);
    if (asset?.isNode) nodes.push(asset as NodeAsset);
  }
  return nodes;
};
