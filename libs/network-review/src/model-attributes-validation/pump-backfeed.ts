import {
  activeTopologyBarriers,
  anyBarrier,
  configuredActiveTopology,
  configuredAllowedFlowDirections,
  configuredValveKinds,
  HydraulicModel,
  presetBarriers,
  Pump,
  respectingFlowDirection,
  trace,
} from "@epanet-js/hydraulic-model";

export const pumpBackfeedsItself = (
  pump: Pump,
  model: HydraulicModel,
): boolean => {
  const [upstreamNodeId, downstreamNodeId] = pump.connections;
  if (upstreamNodeId === undefined || downstreamNodeId === undefined)
    return false;

  const directions = configuredAllowedFlowDirections(model.assets);
  const { nodeIds } = trace(
    { nodeIds: [downstreamNodeId], linkIds: [] },
    model.topology,
    anyBarrier(
      activeTopologyBarriers(configuredActiveTopology(model.assets), true),
      respectingFlowDirection(
        presetBarriers(
          ["tanks", "reservoirs"],
          model.assetIndex,
          directions,
          configuredValveKinds(model.assets),
        ),
        model.topology,
        directions,
      ),
    ),
  );

  return nodeIds.includes(upstreamNodeId);
};
