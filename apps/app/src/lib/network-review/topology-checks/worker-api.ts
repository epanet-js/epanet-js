import {
  findTopologyIssues,
  type TopologyIssues,
} from "@epanet-js/network-review";
import { AssetIndexView } from "src/hydraulic-model/asset-index-transferable";
import { TopologyView } from "src/hydraulic-model/topology/topology-transferable";
import { AllowedFlowDirectionView } from "src/lib/trace/trace-buffers";
import { JunctionDemandView, RunData } from "./data";

export interface TopologyChecksWorkerAPI {
  findTopologyIssues: (data: RunData) => TopologyIssues;
}

function run(data: RunData): TopologyIssues {
  const assetIndex = new AssetIndexView(data.assetIndexBuffers);

  return findTopologyIssues(
    new TopologyView(data.topologyBuffers, assetIndex),
    assetIndex,
    new AllowedFlowDirectionView(data.allowedFlowDirectionBuffers, assetIndex),
    new JunctionDemandView(data.junctionDemandBuffers, assetIndex),
  );
}

export const workerAPI: TopologyChecksWorkerAPI = {
  findTopologyIssues: run,
};
