import {
  BinaryData,
  BufferType,
  DataSize,
  encodeNumber,
  decodeNumber,
  FixedSizeBufferView,
  FixedSizeBufferBuilder,
} from "src/lib/buffers";
import { AssetId, InternalId } from "./asset-types/base-asset";

const ASSET_TYPE_LINK = 0;
const ASSET_TYPE_NODE = 1;
const EMPTY_ASSET_INDEX = 0xffffffff;
const ASSET_INDEX_SIZE = DataSize.number;
const ASSET_INDEX_BIT_ENCODING_MASK = 0x7fffffff;

function encodeAssetIndex(type: 0 | 1, index: number): number {
  return (type << 31) | (index & ASSET_INDEX_BIT_ENCODING_MASK);
}

function decodeAssetIndex(
  encoded: number,
): { type: 0 | 1; index: number } | null {
  if (encoded === EMPTY_ASSET_INDEX) {
    return null;
  }
  const type = ((encoded >>> 31) & 1) as 0 | 1;
  const index = encoded & ASSET_INDEX_BIT_ENCODING_MASK;
  return { type, index };
}

function encodeAssetIndexEntry(
  value: number,
  offset: number,
  view: DataView,
): void {
  encodeNumber(value, offset, view);
}

function decodeAssetIndexEntry(offset: number, view: DataView): number {
  return decodeNumber(offset, view);
}

export class AssetIndex {
  private linkInternalIds: InternalId[] = [];
  private nodeInternalIds: InternalId[] = [];
  private linkBufferIndexMap: Map<InternalId, number> = new Map();
  private nodeBufferIndexMap: Map<InternalId, number> = new Map();
  private maxInternalId: number = -1;

  addLink(internalId: InternalId): void {
    const bufferIndex = this.linkInternalIds.length;
    this.linkInternalIds.push(internalId);
    this.linkBufferIndexMap.set(internalId, bufferIndex);
    this.maxInternalId = Math.max(this.maxInternalId, internalId);
  }

  addNode(internalId: InternalId): void {
    const bufferIndex = this.nodeInternalIds.length;
    this.nodeInternalIds.push(internalId);
    this.nodeBufferIndexMap.set(internalId, bufferIndex);
    this.maxInternalId = Math.max(this.maxInternalId, internalId);
  }

  static toAssetId(internalId: InternalId): AssetId {
    return String(internalId);
  }

  static toInternalId(assetId: AssetId): InternalId {
    return Number(assetId);
  }

  *iterateLinkInternalIds(): Generator<InternalId, void, unknown> {
    for (const internalId of this.linkInternalIds) {
      yield internalId;
    }
  }

  *iterateNodeInternalIds(): Generator<InternalId, void, unknown> {
    for (const internalId of this.nodeInternalIds) {
      yield internalId;
    }
  }

  get linkCount(): number {
    return this.linkInternalIds.length;
  }

  get nodeCount(): number {
    return this.nodeInternalIds.length;
  }

  encode(bufferType: BufferType = "array"): BinaryData {
    const count = this.maxInternalId + 1;
    const builder = new FixedSizeBufferBuilder<number>(
      ASSET_INDEX_SIZE,
      count,
      bufferType,
      encodeAssetIndexEntry,
    );

    for (let i = 0; i < count; i++) {
      builder.add(EMPTY_ASSET_INDEX);
    }

    const buffer = builder.finalize();
    const view = new DataView(buffer);

    for (const [internalId, bufferIndex] of this.linkBufferIndexMap) {
      const encoded = encodeAssetIndex(ASSET_TYPE_LINK, bufferIndex);
      const offset = DataSize.number + internalId * ASSET_INDEX_SIZE;
      encodeAssetIndexEntry(encoded, offset, view);
    }

    for (const [internalId, bufferIndex] of this.nodeBufferIndexMap) {
      const encoded = encodeAssetIndex(ASSET_TYPE_NODE, bufferIndex);
      const offset = DataSize.number + internalId * ASSET_INDEX_SIZE;
      encodeAssetIndexEntry(encoded, offset, view);
    }

    return buffer;
  }
}

export class AssetIndexView {
  private view: FixedSizeBufferView<number>;

  constructor(buffer: BinaryData) {
    this.view = new FixedSizeBufferView(
      buffer,
      ASSET_INDEX_SIZE,
      decodeAssetIndexEntry,
    );
  }

  getLinkIndex(internalId: InternalId): number | null {
    if (internalId < 0 || internalId >= this.view.count) {
      return null;
    }
    const encoded = this.view.getById(internalId);
    const decoded = decodeAssetIndex(encoded);
    if (decoded === null || decoded.type !== ASSET_TYPE_LINK) {
      return null;
    }
    return decoded.index;
  }

  getNodeIndex(internalId: InternalId): number | null {
    if (internalId < 0 || internalId >= this.view.count) {
      return null;
    }
    const encoded = this.view.getById(internalId);
    const decoded = decodeAssetIndex(encoded);
    if (decoded === null || decoded.type !== ASSET_TYPE_NODE) {
      return null;
    }
    return decoded.index;
  }

  hasLink(internalId: InternalId): boolean {
    return this.getLinkIndex(internalId) !== null;
  }

  hasNode(internalId: InternalId): boolean {
    return this.getNodeIndex(internalId) !== null;
  }

  get count(): number {
    return this.view.count;
  }
}
