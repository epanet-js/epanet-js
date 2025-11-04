import { FixedSizeBufferView, VariableSizeBufferView } from "src/lib/buffers";
import { AssetId, NO_ASSET_ID } from "../asset-types/base-asset";
import { TopologyBaseQueries, TopologyBuffers } from "./types";
import { AssetIndexView } from "../asset-index";
import {
  decodeLinkConnections,
  decodeNodeConnections,
} from "./topologyEncoder";

export class TopologyView implements TopologyBaseQueries {
  private linkConnectionsView: FixedSizeBufferView<[number, number]>;
  private nodeConnectionsView: VariableSizeBufferView<number[]>;
  private assetIndexView: AssetIndexView;

  constructor(buffers: TopologyBuffers, assetIndexView: AssetIndexView) {
    this.linkConnectionsView = new FixedSizeBufferView(
      buffers.linkConnections,
      8,
      decodeLinkConnections,
    );

    this.nodeConnectionsView = new VariableSizeBufferView(
      buffers.nodeConnections,
      decodeNodeConnections,
    );

    this.assetIndexView = assetIndexView;
  }

  hasLink(linkId: AssetId): boolean {
    return this.assetIndexView.hasLink(linkId);
  }

  hasNode(nodeId: AssetId): boolean {
    return this.assetIndexView.hasNode(nodeId);
  }

  getLinks(nodeId: AssetId): AssetId[] {
    const nodeIndex = this.assetIndexView.getNodeIndex(nodeId);
    if (nodeIndex === null) {
      return [];
    }
    return this.nodeConnectionsView.getById(nodeIndex);
  }

  getNodes(linkId: AssetId): [AssetId, AssetId] {
    const linkIndex = this.assetIndexView.getLinkIndex(linkId);
    if (linkIndex === null) {
      return [NO_ASSET_ID, NO_ASSET_ID];
    }
    return this.linkConnectionsView.getById(linkIndex);
  }
}
