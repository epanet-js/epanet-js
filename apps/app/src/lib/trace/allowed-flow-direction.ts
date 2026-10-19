import {
  AssetId,
  Asset,
  Pipe,
  Valve,
  AllowedFlowDirection as AFD,
  getAllowedFlowDirectionFromAssetConfig,
  type AllowedFlowDirectionQueries,
  type AllowedFlowDirectionValue,
} from "@epanet-js/hydraulic-model";
import { AssetsMap } from "@epanet-js/hydraulic-model";
import { ResultsReader } from "@epanet-js/simulation";
import { FLOW_TOLERANCE } from "./types";

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
