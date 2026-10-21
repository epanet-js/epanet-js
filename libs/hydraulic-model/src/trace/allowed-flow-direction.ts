import { Asset, Pipe, Pump, Valve } from "../asset-types";
import { AssetsMap } from "../assets-map";
import {
  AllowedFlowDirection as AFD,
  AllowedFlowDirectionQueries,
  AllowedFlowDirectionValue,
} from "./types";

export const configuredAllowedFlowDirections = (
  assets: AssetsMap,
): AllowedFlowDirectionQueries => ({
  getAllowedFlowDirection: (linkId) => {
    const asset = assets.get(linkId);
    if (!asset) return AFD.NONE;
    return getAllowedFlowDirectionFromAssetConfig(asset);
  },
});

export const unrestrictedFlowDirections: AllowedFlowDirectionQueries = {
  getAllowedFlowDirection: () => AFD.BOTH,
};

export function getAllowedFlowDirectionFromAssetConfig(
  asset: Asset,
): AllowedFlowDirectionValue {
  switch (asset.type) {
    case "pipe": {
      const pipe = asset as Pipe;
      if (pipe.initialStatus === "closed") return AFD.NONE;
      if (pipe.initialStatus === "cv") return AFD.DOWNSTREAM;
      return AFD.BOTH;
    }
    case "pump": {
      const pump = asset as unknown as Pump;
      return pump.initialStatus === "off" ? AFD.NONE : AFD.DOWNSTREAM;
    }
    case "valve": {
      const valve = asset as unknown as Valve;
      if (valve.kind === "tcv") {
        return valve.initialStatus === "closed" ? AFD.NONE : AFD.BOTH;
      }
      return valve.initialStatus === "closed" ? AFD.NONE : AFD.DOWNSTREAM;
    }
    default:
      return AFD.NONE;
  }
}
