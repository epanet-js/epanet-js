import {
  AssetId,
  Asset,
  Pipe,
  Pump,
  Valve,
} from "src/hydraulic-model/asset-types";
import { AssetsMap } from "src/hydraulic-model/assets-map";
import { ResultsReader } from "src/simulation/results-reader";
import {
  AllowedFlowDirection as AFD,
  AllowedFlowDirectionQueries,
  AllowedFlowDirectionValue,
  FLOW_TOLERANCE,
} from "./types";

export class AllowedFlowDirection implements AllowedFlowDirectionQueries {
  constructor(
    private assets: AssetsMap,
    private resultsReader: ResultsReader | null,
  ) {}

  getAllowedFlowDirection(linkId: AssetId): AllowedFlowDirectionValue {
    const asset = this.assets.get(linkId);
    if (!asset) return AFD.NONE;

    if (this.resultsReader) {
      return getAllowedFlowDirectionFromSimulation(
        linkId,
        asset,
        this.resultsReader,
      );
    }

    return getAllowedFlowDirectionFromAssetConfig(asset);
  }
}

function getAllowedFlowDirectionFromSimulation(
  id: AssetId,
  asset: Asset,
  resultsReader: ResultsReader,
): AllowedFlowDirectionValue {
  switch (asset.type) {
    case "pipe": {
      const sim = resultsReader.getPipe(id);
      if (sim?.status === "closed") return AFD.NONE;
      const pipe = asset as Pipe;
      if (pipe.initialStatus === "cv") return AFD.DOWNSTREAM;
      if (Math.abs(sim?.flow ?? 0) > FLOW_TOLERANCE) return AFD.BOTH;
      return AFD.NONE;
    }
    case "pump": {
      const sim = resultsReader.getPump(id);
      if (!sim || sim.status === "off") return AFD.NONE;
      return AFD.DOWNSTREAM;
    }
    case "valve": {
      const sim = resultsReader.getValve(id);
      if (sim?.status === "closed") return AFD.NONE;
      if (Math.abs(sim?.flow ?? 0) <= FLOW_TOLERANCE) return AFD.NONE;
      const valve = asset as unknown as Valve;
      if (valve.kind === "tcv") return AFD.BOTH;
      return AFD.DOWNSTREAM;
    }
    default:
      return AFD.NONE;
  }
}

function getAllowedFlowDirectionFromAssetConfig(
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
