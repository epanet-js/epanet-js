import {
  BinaryData,
  BufferType,
  DataSize,
  decodeType,
  encodeType,
  FixedSizeBufferBuilder,
  FixedSizeBufferView,
} from "src/lib/buffers";
import { AssetId, AssetType, LinkType, NodeType } from "./asset-types";
import { AssetsMap } from "./assets-map";
import {
  AssetIndex,
  AssetIndexBaseQueries,
  AssetIndexView,
} from "./asset-index";

export interface AssetTypeBaseQueries {
  getAssetType(id: AssetId): AssetType | undefined;
  getNodeType(id: AssetId): NodeType | undefined;
  getLinkType(id: AssetId): LinkType | undefined;
}

export class AssetTypeQueries implements AssetTypeBaseQueries {
  constructor(
    private assetsMap: AssetsMap,
    private assetIndex: AssetIndex,
  ) {
    return;
  }

  getAssetType(id: AssetId) {
    const asset = this.assetsMap.get(id);
    if (!asset) return;

    return asset.type as AssetType;
  }

  getNodeType(id: AssetId) {
    const asset = this.assetsMap.get(id);
    if (!asset || !asset.isNode) return;

    return asset.type as NodeType;
  }

  getLinkType(id: AssetId) {
    const asset = this.assetsMap.get(id);
    if (!asset || !asset.isLink) return;

    return asset.type as LinkType;
  }

  getEncoder(bufferType: BufferType = "array"): AssetTypesEncoder {
    return new AssetTypesEncoder(this.assetsMap, this.assetIndex, bufferType);
  }
}

const ASSET_TYPE_SIZE = DataSize.type;

const NODE_TYPE_MAP = { junction: 1, tank: 2, reservoir: 3 } as const;

const NODE_TYPE_REVERSE_MAP: Record<number, NodeType> = {
  [NODE_TYPE_MAP.junction]: "junction",
  [NODE_TYPE_MAP.tank]: "tank",
  [NODE_TYPE_MAP.reservoir]: "reservoir",
} as const;

function toNodeTypeId(type: AssetType) {
  return NODE_TYPE_MAP[type as keyof typeof NODE_TYPE_MAP];
}

function toNodeType(typeId: number): NodeType {
  return NODE_TYPE_REVERSE_MAP[typeId];
}

const LINK_TYPE_MAP = { pipe: 1, valve: 2, pump: 3 } as const;

const LINK_TYPE_REVERSE_MAP: Record<number, LinkType> = {
  [LINK_TYPE_MAP.pipe]: "pipe",
  [LINK_TYPE_MAP.valve]: "valve",
  [LINK_TYPE_MAP.pump]: "pump",
} as const;

function toLinkTypeId(type: AssetType) {
  return LINK_TYPE_MAP[type as keyof typeof LINK_TYPE_MAP];
}

function toLinkType(typeId: number): LinkType {
  return LINK_TYPE_REVERSE_MAP[typeId];
}

function encodeLinkType(type: AssetType, offset: number, view: DataView) {
  const linkTypeId = toLinkTypeId(type);
  encodeType(linkTypeId, offset, view);
}

function encodeNodeType(type: AssetType, offset: number, view: DataView) {
  const nodeTypeId = toNodeTypeId(type);
  encodeType(nodeTypeId, offset, view);
}

function decodeLinkType(offset: number, view: DataView): LinkType | undefined {
  const linkTypeId = decodeType(offset, view);
  return toLinkType(linkTypeId);
}

function decodeNodeType(offset: number, view: DataView): NodeType | undefined {
  const nodeTypeId = decodeType(offset, view);
  return toNodeType(nodeTypeId);
}

export type AssetTypeBuffers = {
  linkTypes: BinaryData;
  nodeTypes: BinaryData;
};

export class AssetTypesEncoder {
  private linkTypesBufferBuilder: FixedSizeBufferBuilder<LinkType>;
  private nodeTypesBufferBuilder: FixedSizeBufferBuilder<NodeType>;

  constructor(
    private assets: AssetsMap,
    private assetIndex: AssetIndexBaseQueries,
    bufferType: BufferType = "array",
  ) {
    this.linkTypesBufferBuilder = new FixedSizeBufferBuilder<LinkType>(
      ASSET_TYPE_SIZE,
      this.assetIndex.linkCount,
      bufferType,
      encodeLinkType,
    );
    this.nodeTypesBufferBuilder = new FixedSizeBufferBuilder<NodeType>(
      ASSET_TYPE_SIZE,
      this.assetIndex.nodeCount,
      bufferType,
      encodeNodeType,
    );
  }

  encode(): AssetTypeBuffers {
    for (const [id, nodeIndex] of this.assetIndex.iterateNodes()) {
      const asset = this.assets.get(id)!;
      this.encodeNode(asset.type as NodeType, nodeIndex);
    }
    for (const [id, linkIndex] of this.assetIndex.iterateLinks()) {
      const asset = this.assets.get(id)!;
      this.encodeLink(asset.type as LinkType, linkIndex);
    }

    return this.finalize();
  }

  encodeNode(nodeType: NodeType, index: number) {
    this.nodeTypesBufferBuilder.addAtIndex(index, nodeType);
  }

  encodeLink(linkType: LinkType, index: number) {
    this.linkTypesBufferBuilder.addAtIndex(index, linkType);
  }

  finalize(): AssetTypeBuffers {
    return {
      nodeTypes: this.nodeTypesBufferBuilder.finalize(),
      linkTypes: this.linkTypesBufferBuilder.finalize(),
    };
  }
}

export class AssetTypesView implements AssetTypeBaseQueries {
  private nodeTypesView: FixedSizeBufferView<NodeType | undefined>;
  private linkTypesView: FixedSizeBufferView<LinkType | undefined>;

  constructor(
    buffers: AssetTypeBuffers,
    private assetIndex: AssetIndexView,
  ) {
    this.nodeTypesView = new FixedSizeBufferView(
      buffers.nodeTypes,
      ASSET_TYPE_SIZE,
      decodeNodeType,
    );
    this.linkTypesView = new FixedSizeBufferView(
      buffers.linkTypes,
      ASSET_TYPE_SIZE,
      decodeLinkType,
    );
  }

  getAssetType(id: AssetId) {
    if (this.assetIndex.hasLink(id)) {
      return this.getLinkType(id);
    }
    return this.getNodeType(id);
  }

  getNodeType(id: AssetId) {
    const nodeIndex = this.assetIndex.getNodeIndex(id);
    if (nodeIndex === null) return undefined;
    return this.nodeTypesView.getById(nodeIndex);
  }

  getLinkType(id: AssetId) {
    const linkIndex = this.assetIndex.getLinkIndex(id);
    if (linkIndex === null) return undefined;
    return this.linkTypesView.getById(linkIndex);
  }
}
