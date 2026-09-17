import type { Asset, Valve } from "@epanet-js/hydraulic-model";
import type { HydraulicModel } from "src/hydraulic-model";

export const VALVE_TARGET_NODE_FIELD = "targetNodeId";

export const valveTargetNodeLabel = (
  hydraulicModel: HydraulicModel,
  asset: Asset,
): string => {
  const valve = asset as Valve;
  if (valve.kind !== "prv" || valve.targetNodeId === undefined) return "";

  const target = hydraulicModel.assets.get(valve.targetNodeId);
  return target?.isNode ? target.label : "";
};
