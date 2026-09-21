import { AssetId, Valve } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model/hydraulic-model";
import { runTrace } from "src/lib/trace";

export type TargetNodeOption = { value: AssetId; label: string };

export const findTargetNodeOptions = async (
  hydraulicModel: HydraulicModel,
  valve: Valve,
  signal?: AbortSignal,
): Promise<TargetNodeOption[]> => {
  const endNodeId = valve.connections[1];
  if (endNodeId === undefined) return [];

  const traced = await runTrace(
    hydraulicModel,
    null,
    { mode: "boundary", startNodeIds: [endNodeId], startLinkIds: [] },
    signal,
  );

  const options: TargetNodeOption[] = [];
  for (const id of traced) {
    if (id === endNodeId) continue;
    const asset = hydraulicModel.assets.get(id);
    if (!asset?.isNode) continue;
    options.push({ value: asset.id, label: asset.label });
  }
  return options;
};
