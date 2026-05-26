import { AssetId, Asset, Pipe, Valve } from "src/hydraulic-model/asset-types";
import { AssetsMap } from "src/hydraulic-model/assets-map";
import { ResultsReader } from "src/simulation/results-reader";
import {
  FlowDirectionQueries,
  FlowDirection as FlowDir,
  FlowDirectionValue,
  FLOW_TOLERANCE,
} from "./types";

export class FlowDirection implements FlowDirectionQueries {
  constructor(
    private assets: AssetsMap,
    private resultsReader: ResultsReader | null,
  ) {}

  getFlowDirection(linkId: AssetId): FlowDirectionValue {
    const asset = this.assets.get(linkId);
    if (!asset) return FlowDir.NONE;

    if (this.resultsReader) {
      return getFlowDirectionFromSimulation(linkId, asset, this.resultsReader);
    }

    return getFlowDirectionFromAssetConfig(asset);
  }
}

function getFlowDirectionFromSimulation(
  id: AssetId,
  asset: Asset,
  resultsReader: ResultsReader,
): FlowDirectionValue {
  let flow: number;

  switch (asset.type) {
    case "pipe": {
      const sim = resultsReader.getPipe(id);
      if (sim?.status === "closed") return FlowDir.NONE;
      flow = sim?.flow ?? 0;
      break;
    }
    case "valve": {
      const sim = resultsReader.getValve(id);
      if (sim?.status === "closed") return FlowDir.NONE;
      flow = sim?.flow ?? 0;
      break;
    }
    case "pump": {
      flow = resultsReader.getPump(id)?.flow ?? 0;
      break;
    }
    default:
      return FlowDir.NONE;
  }

  if (flow > FLOW_TOLERANCE) return FlowDir.DOWNSTREAM;
  if (flow < -FLOW_TOLERANCE) return FlowDir.UPSTREAM;
  return FlowDir.NONE;
}

/**
 * Without simulation: derive flow direction from asset properties.
 * Closed assets return NONE, open assets return DOWNSTREAM
 * (water theoretically flows in the pipe definition direction).
 */
function getFlowDirectionFromAssetConfig(asset: Asset): FlowDirectionValue {
  switch (asset.type) {
    case "pipe": {
      const pipe = asset as Pipe;
      if (pipe.initialStatus === "closed") return FlowDir.NONE;
      return FlowDir.DOWNSTREAM;
    }
    case "valve": {
      const valve = asset as unknown as Valve;
      if (valve.kind === "tcv") {
        return valve.initialStatus === "closed"
          ? FlowDir.NONE
          : FlowDir.DOWNSTREAM;
      }
      return FlowDir.NONE;
    }
    case "pump":
      return FlowDir.NONE;
    default:
      return FlowDir.NONE;
  }
}
