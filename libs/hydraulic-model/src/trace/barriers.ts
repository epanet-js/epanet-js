import { valveKinds, type ValveKind } from "@epanet-js/model-schema";
import { AssetId, Valve } from "../asset-types";
import { AssetIndexQueries } from "../asset-index";
import { AssetsMap } from "../assets-map";
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
): TraceBarriers => ({
  isNodeBarrier: (nodeId) => {
    const nodeType = assetIndex.getNodeType(nodeId);
    return (
      (nodeType === "tank" && presets.has("tanks")) ||
      (nodeType === "reservoir" && presets.has("reservoirs"))
    );
  },
  isLinkBarrier: (linkId) => {
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
  },
});

export const boundaryBarriers = (
  assetIndex: AssetIndexQueries,
  status: AllowedFlowDirectionQueries,
): TraceBarriers =>
  typeBarriers(new Set(boundaryStopPresets), assetIndex, status);

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
    isLinkBarrier: (linkId) => {
      if (byType.isLinkBarrier(linkId)) return true;
      const kind = valveKinds.getValveKind(linkId);
      return kind !== undefined && selected.has(kind);
    },
  };
};

export const anyBarrier = (...barriers: TraceBarriers[]): TraceBarriers => ({
  isNodeBarrier: (nodeId) => barriers.some((b) => b.isNodeBarrier(nodeId)),
  isLinkBarrier: (linkId) => barriers.some((b) => b.isLinkBarrier(linkId)),
});
