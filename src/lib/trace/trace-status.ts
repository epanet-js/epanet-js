import { AssetId, Asset, Pipe, Valve } from "src/hydraulic-model/asset-types";
import { AssetsMap } from "src/hydraulic-model/assets-map";
import { ResultsReader } from "src/simulation/results-reader";
import {
  TraceStatusQueries,
  LinkTraversal,
  LinkTraversalValue,
  NodeTraversal,
  NodeTraversalValue,
  FlowDirection,
  FlowDirectionValue,
  FLOW_TOLERANCE,
} from "./types";

export class TraceStatus implements TraceStatusQueries {
  constructor(
    private assets: AssetsMap,
    private resultsReader: ResultsReader | null,
  ) {}

  getNodeTraversal(nodeId: AssetId): NodeTraversalValue {
    const asset = this.assets.get(nodeId);
    if (!asset) return NodeTraversal.FREE;
    return classifyNode(asset);
  }

  getLinkTraversal(linkId: AssetId): LinkTraversalValue {
    const asset = this.assets.get(linkId);
    if (!asset) return LinkTraversal.FREE;
    return classifyLink(linkId, asset, this.resultsReader);
  }

  getFlowDirection(linkId: AssetId): FlowDirectionValue {
    if (!this.resultsReader) return FlowDirection.NONE;
    const asset = this.assets.get(linkId);
    if (!asset) return FlowDirection.NONE;
    return getFlowDirection(linkId, asset, this.resultsReader);
  }
}

function classifyLink(
  linkId: AssetId,
  asset: Asset,
  resultsReader: ResultsReader | null,
): LinkTraversalValue {
  switch (asset.type) {
    case "pipe": {
      const pipe = asset as Pipe;
      const sim = resultsReader?.getPipe(linkId);
      const isClosed = sim
        ? sim.status === "closed"
        : pipe.initialStatus === "closed";
      if (isClosed) return LinkTraversal.BOUNDARY;
      if (pipe.initialStatus === "cv") return LinkTraversal.ONE_WAY;
      return LinkTraversal.FREE;
    }
    case "valve": {
      const valve = asset as unknown as Valve;
      if (valve.kind === "tcv") {
        const sim = resultsReader?.getValve(linkId);
        const isClosed = sim
          ? sim.status === "closed"
          : valve.initialStatus === "closed";
        return isClosed ? LinkTraversal.BOUNDARY : LinkTraversal.FREE;
      }
      return LinkTraversal.BOUNDARY;
    }
    case "pump":
      return LinkTraversal.BOUNDARY;
    default:
      return LinkTraversal.FREE;
  }
}

function classifyNode(asset: Asset): NodeTraversalValue {
  switch (asset.type) {
    case "tank":
    case "reservoir":
      return NodeTraversal.BOUNDARY;
    default:
      return NodeTraversal.FREE;
  }
}

function getFlowDirection(
  id: AssetId,
  asset: Asset,
  resultsReader: ResultsReader,
): FlowDirectionValue {
  let flow: number;
  switch (asset.type) {
    case "pipe":
      flow = resultsReader.getPipe(id)?.flow ?? 0;
      break;
    case "valve":
      flow = resultsReader.getValve(id)?.flow ?? 0;
      break;
    case "pump":
      flow = resultsReader.getPump(id)?.flow ?? 0;
      break;
    default:
      return FlowDirection.NONE;
  }

  if (flow > FLOW_TOLERANCE) return FlowDirection.DOWNSTREAM;
  if (flow < -FLOW_TOLERANCE) return FlowDirection.UPSTREAM;
  return FlowDirection.NONE;
}
