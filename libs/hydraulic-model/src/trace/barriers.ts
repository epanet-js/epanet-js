import { valveKinds, type ValveKind } from "@epanet-js/model-schema";
import { AssetId, Valve } from "../asset-types";
import { AssetIndexQueries } from "../asset-index";
import { AssetsMap } from "../assets-map";
import { TopologyQueries } from "../topology";
import {
  AllowedFlowDirection,
  AllowedFlowDirectionQueries,
  TraceBarriers,
} from "./types";

const typeStopPresets = [
  "tanks",
  "reservoirs",
  "pumps",
  "valves",
  "controlValves",
  "cv",
  "closed",
] as const;

type TypeStopPreset = (typeof typeStopPresets)[number];

export const stopPresets = [...typeStopPresets, ...valveKinds] as const;

export type StopPreset = (typeof stopPresets)[number];

export const boundaryStopPresets: TypeStopPreset[] = [
  "tanks",
  "reservoirs",
  "pumps",
  "controlValves",
];

export const isStopPreset = (value: unknown): value is StopPreset =>
  (stopPresets as readonly unknown[]).includes(value);

export interface ValveKindQueries {
  getValveKind(linkId: AssetId): ValveKind | undefined;
}

export const configuredValveKinds = (assets: AssetsMap): ValveKindQueries => ({
  getValveKind: (linkId) => {
    const asset = assets.get(linkId);
    return asset?.type === "valve" ? (asset as Valve).kind : undefined;
  },
});

const typeBarriers = (
  presets: ReadonlySet<StopPreset>,
  assetIndex: AssetIndexQueries,
  status: AllowedFlowDirectionQueries,
): TraceBarriers => {
  const isLinkOfStoppedType = (linkId: AssetId): boolean => {
    if (
      presets.has("closed") &&
      status.getAllowedFlowDirection(linkId) === AllowedFlowDirection.NONE
    ) {
      return true;
    }
    switch (assetIndex.getLinkType(linkId)) {
      case "pump":
        return presets.has("pumps");
      case "valve":
        return (
          presets.has("valves") ||
          (presets.has("controlValves") &&
            status.getAllowedFlowDirection(linkId) !==
              AllowedFlowDirection.BOTH)
        );
      case "pipe":
        return (
          presets.has("cv") &&
          status.getAllowedFlowDirection(linkId) ===
            AllowedFlowDirection.DOWNSTREAM
        );
      default:
        return false;
    }
  };

  return {
    isNodeBarrier: (nodeId) => {
      const nodeType = assetIndex.getNodeType(nodeId);
      return (
        (nodeType === "tank" && presets.has("tanks")) ||
        (nodeType === "reservoir" && presets.has("reservoirs"))
      );
    },
    linkStopReason: (linkId) =>
      isLinkOfStoppedType(linkId) ? "barrier" : null,
  };
};

export const respectingFlowDirection = (
  barriers: TraceBarriers,
  topology: TopologyQueries,
  status: AllowedFlowDirectionQueries,
): TraceBarriers => ({
  isNodeBarrier: (nodeId) => barriers.isNodeBarrier(nodeId),
  linkStopReason: (linkId, fromNodeId) => {
    const direction = status.getAllowedFlowDirection(linkId);
    if (direction === AllowedFlowDirection.NONE) return "closed";

    const reason = barriers.linkStopReason(linkId, fromNodeId);
    if (reason !== null) return reason;

    if (direction === AllowedFlowDirection.BOTH) return null;
    const [startNode, endNode] = topology.getNodes(linkId);
    if (
      direction === AllowedFlowDirection.DOWNSTREAM &&
      fromNodeId !== startNode
    )
      return "direction";
    if (direction === AllowedFlowDirection.UPSTREAM && fromNodeId !== endNode)
      return "direction";
    return null;
  },
});

export const boundaryBarriers = (
  topology: TopologyQueries,
  assetIndex: AssetIndexQueries,
  status: AllowedFlowDirectionQueries,
): TraceBarriers =>
  respectingFlowDirection(
    typeBarriers(new Set(boundaryStopPresets), assetIndex, status),
    topology,
    status,
  );

export const presetBarriers = (
  presets: readonly StopPreset[],
  assetIndex: AssetIndexQueries,
  status: AllowedFlowDirectionQueries,
  valveKinds: ValveKindQueries,
): TraceBarriers => {
  const selected = new Set(presets);
  const byType = typeBarriers(selected, assetIndex, status);
  return {
    isNodeBarrier: (nodeId) => byType.isNodeBarrier(nodeId),
    linkStopReason: (linkId, fromNodeId) => {
      const reason = byType.linkStopReason(linkId, fromNodeId);
      if (reason !== null) return reason;
      const kind = valveKinds.getValveKind(linkId);
      return kind !== undefined && selected.has(kind) ? "barrier" : null;
    },
  };
};

export const anyBarrier = (...barriers: TraceBarriers[]): TraceBarriers => ({
  isNodeBarrier: (nodeId) => barriers.some((b) => b.isNodeBarrier(nodeId)),
  linkStopReason: (linkId, fromNodeId) => {
    for (const barrier of barriers) {
      const reason = barrier.linkStopReason(linkId, fromNodeId);
      if (reason !== null) return reason;
    }
    return null;
  },
});
