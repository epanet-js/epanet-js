import { FixedSizeBufferView, VariableSizeBufferView } from "src/lib/buffers";
import { InternalId } from "../asset-types/base-asset";
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

  hasLink(linkId: InternalId): boolean {
    return this.assetIndexView.hasLink(linkId);
  }

  hasNode(nodeId: InternalId): boolean {
    return this.assetIndexView.hasNode(nodeId);
  }

  getLinks(nodeId: InternalId): InternalId[] {
    const nodeIndex = this.assetIndexView.getNodeIndex(nodeId);
    if (nodeIndex === null) {
      throw new Error(`Node ID ${nodeId} does not exist in topology`);
    }
    return this.nodeConnectionsView.getById(nodeIndex);
  }

  getNodes(linkId: InternalId): [InternalId, InternalId] {
    const linkIndex = this.assetIndexView.getLinkIndex(linkId);
    if (linkIndex === null) {
      throw new Error(`Link ID ${linkId} does not exist in topology`);
    }
    return this.linkConnectionsView.getById(linkIndex);
  }
}
