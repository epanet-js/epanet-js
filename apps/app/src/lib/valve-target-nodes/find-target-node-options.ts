import {
  AssetId,
  Valve,
  pickTargetNodeOptions,
} from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model/hydraulic-model";
import { runTrace } from "src/lib/trace";

export type TargetNodeOption = { value: AssetId; label: string };

export const findTargetNodeOptions = async (
  hydraulicModel: HydraulicModel,
  valve: Valve,
  isScriptingOn: boolean,
  signal?: AbortSignal,
): Promise<TargetNodeOption[]> => {
  const endNodeId = valve.connections[1];
  if (endNodeId === undefined) return [];

  const traced = await runTrace(
    hydraulicModel,
    null,
    { mode: "boundary", startNodeIds: [endNodeId], startLinkIds: [] },
    isScriptingOn,
    signal,
  );

  return pickTargetNodeOptions(hydraulicModel.assets, valve, traced).map(
    (node) => ({ value: node.id, label: node.label }),
  );
};
