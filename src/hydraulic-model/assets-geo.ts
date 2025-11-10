import {
  BinaryData,
  BufferType,
  BufferWithIndex,
  DataSize,
  decodeDecimal,
  decodeNumber,
  encodeDecimal,
  encodeNumber,
  FixedSizeBufferBuilder,
  FixedSizeBufferView,
  GeoIndexBuilder,
  VariableSizeBufferBuilder,
  VariableSizeBufferView,
} from "src/lib/buffers";
import { AssetIndex, AssetIndexQueries } from "./asset-index";
import { AssetId, LinkAsset, NodeAsset } from "./asset-types";
import { LineString, Position } from "geojson";
import Flatbush from "flatbush";
import bbox from "@turf/bbox";
import lineSegment from "@turf/line-segment";
import { AssetsMap } from "./assets-map";

type SegmentId = number;
type BoundingBox = [number, number, number, number];
type NodeFilterFn = (nodeId: AssetId, bounds: BoundingBox) => boolean;
type SegmentFilterFn = (segmentId: SegmentId, bounds: BoundingBox) => boolean;
export interface AssetsGeoQueries {
  getNodePosition(id: AssetId): Position | undefined;
  getLinkBounds(id: AssetId): BoundingBox | undefined;
  getSegmentCoords(segmentId: SegmentId): [Position, Position];
  getSegmentLinkId(segmentId: SegmentId): AssetId;
  getLinkSegments(id: AssetId): SegmentId[];
  get segmentsCount(): number;
  searchNodes(bounds: BoundingBox, filterFn?: NodeFilterFn): AssetId[];
  searchLinkSegments(
    bounds: BoundingBox,
    filterFn?: SegmentFilterFn,
  ): SegmentId[];
  getNeighbouringNodes(
    pos: Position,
    maxCount: number,
    maxDistance: number,
  ): AssetId[];
}

type Segment = { linkId: AssetId; coords: [Position, Position] };
export class AssetsGeoIndex implements AssetsGeoQueries {
  private segments: Segment[] = [];
  private linkSegmentsIndex: Map<AssetId, SegmentId[]> = new Map();
  private nodesSpatialIndex?: Flatbush;
  private segmentsSpatialIndex?: Flatbush;
  private _segmentsCount: number = 0;

  constructor(
    private assets: AssetsMap,
    private assetIndex: AssetIndex,
  ) {
    for (const [linkId] of this.assetIndex.iterateLinks()) {
      const link = this.assets.get(linkId) as LinkAsset;
      const linkGeometry = link.feature.geometry as LineString;
      const segments = lineSegment(linkGeometry).features;
      segments.forEach((seg) => {
        const segmentId = this.segments.length;
        const segmentCoords = seg.geometry.coordinates as [Position, Position];
        this.segments.push({ linkId, coords: segmentCoords });
        if (!this.linkSegmentsIndex.has(linkId)) {
          this.linkSegmentsIndex.set(linkId, []);
        }
        this.linkSegmentsIndex.get(linkId)!.push(segmentId);
      });
      this._segmentsCount += segments.length;
    }
  }

  get segmentsCount(): number {
    return this._segmentsCount;
  }

  getNodePosition(id: AssetId): Position | undefined {
    const asset = this.assets.get(id);
    if (!asset || !asset.isNode) return undefined;
    return (asset as NodeAsset).feature.geometry.coordinates as Position;
  }

  getLinkBounds(id: AssetId): BoundingBox | undefined {
    const asset = this.assets.get(id);
    if (!asset || !asset.isLink) return undefined;
    const feature = asset.feature;
    const bounds = bbox(feature);
    return [bounds[0], bounds[1], bounds[2], bounds[3]];
  }

  getSegmentCoords(segmentId: SegmentId): [Position, Position] {
    if (segmentId >= this.segments.length)
      throw new Error(
        `Segment index out of bounds. Requested ${segmentId} but max is ${this.segments.length - 1}`,
      );

    return this.segments[segmentId].coords;
  }

  getSegmentLinkId(segmentId: SegmentId): AssetId {
    if (segmentId >= this.segments.length)
      throw new Error(
        `Segment index out of bounds. Requested ${segmentId} but max is ${this.segments.length - 1}`,
      );

    return this.segments[segmentId].linkId;
  }

  getLinkSegments(id: AssetId): SegmentId[] {
    if (!this.assetIndex.hasLink(id)) return [];
    return this.linkSegmentsIndex.get(id) || [];
  }

  searchLinkSegments(
    bounds: BoundingBox,
    filterFn?: SegmentFilterFn,
  ): SegmentId[] {
    if (this.segments.length === 0) return [];
    if (!this.segmentsSpatialIndex) {
      this.buildSegmentsSpatialIndex();
    }
    return this.segmentsSpatialIndex!.search(
      ...bounds,
      (index: number, ...bounds: BoundingBox) =>
        filterFn ? filterFn(index, bounds) : true,
    );
  }

  private buildSegmentsSpatialIndex() {
    this.segmentsSpatialIndex = new Flatbush(this.segments.length);
    this.segments.forEach((segment) => {
      const coords = segment.coords;
      const minX = Math.min(coords[0][0], coords[1][0]);
      const minY = Math.min(coords[0][1], coords[1][1]);
      const maxX = Math.max(coords[0][0], coords[1][0]);
      const maxY = Math.max(coords[0][1], coords[1][1]);
      this.segmentsSpatialIndex!.add(minX, minY, maxX, maxY);
    });
    this.segmentsSpatialIndex.finish();
  }

  searchNodes(bounds: BoundingBox, filterFn?: NodeFilterFn): AssetId[] {
    if (this.assetIndex.nodeCount === 0) return [];
    if (!this.nodesSpatialIndex) {
      this.buildNodesSpatialIndex();
    }
    return this.nodesSpatialIndex!.search(
      ...bounds,
      (index: number, ...bounds: BoundingBox) => {
        if (!filterFn) return true;
        const nodeId = this.assetIndex.getNodeId(index);
        if (!nodeId) return false;
        return filterFn(nodeId, bounds);
      },
    ).map((nodeIndex) => this.assetIndex.getNodeId(nodeIndex)!);
  }

  private buildNodesSpatialIndex() {
    const nodeCount = this.assetIndex.nodeCount;
    this.nodesSpatialIndex = new Flatbush(nodeCount);
    for (const [nodeId] of this.assetIndex.iterateNodes()) {
      const position = this.getNodePosition(nodeId);
      if (!position) continue;
      this.nodesSpatialIndex.add(
        position[0],
        position[1],
        position[0],
        position[1],
      );
    }
    this.nodesSpatialIndex.finish();
  }

  getNeighbouringNodes(
    pos: Position,
    maxCount: number,
    maxDistance: number,
  ): AssetId[] {
    if (!this.nodesSpatialIndex) {
      this.buildNodesSpatialIndex();
    }
    const nodeIndexes = this.nodesSpatialIndex!.neighbors(
      pos[0],
      pos[1],
      maxCount,
      maxDistance,
    );
    return nodeIndexes.map(
      (nodeIndex) => this.assetIndex.getNodeId(nodeIndex)!,
    );
  }
}

export type AssetsGeoBuffers = {
  nodesGeo: BinaryData;
  linksGeo: BinaryData;
  segmentsGeo: BinaryData;
  segmentsLinkIndex: BinaryData;
  linkSegments: BufferWithIndex;
  nodesSpatialIndex: BinaryData;
  segmentsSpatialIndex: BinaryData;
};

export const EncodedSize = {
  coordinate: DataSize.decimal,
  position: DataSize.decimal * 2,
  bounds: DataSize.decimal * 4,
} as const;

function encodePosition(
  position: Position,
  offset: number,
  view: DataView,
): void {
  encodeDecimal(position[0], offset, view);
  encodeDecimal(position[1], offset + DataSize.decimal, view);
}

function decodePosition(offset: number, view: DataView): Position {
  return [
    decodeDecimal(offset, view),
    decodeDecimal(offset + DataSize.decimal, view),
  ];
}

function encodeBounds(
  bounds: BoundingBox,
  offset: number,
  view: DataView,
): void {
  encodePosition([bounds[0], bounds[1]], offset, view);
  encodePosition([bounds[2], bounds[3]], offset + EncodedSize.position, view);
}

function decodeBounds(offset: number, view: DataView): BoundingBox {
  const [minX, minY] = decodePosition(offset, view);
  const [maxX, maxY] = decodePosition(offset + EncodedSize.position, view);
  return [minX, minY, maxX, maxY];
}

function encodeLineCoordinates(
  positions: [Position, Position],
  offset: number,
  view: DataView,
): void {
  encodePosition(positions[0], offset, view);
  encodePosition(positions[1], offset + EncodedSize.position, view);
}

function decodeLineCoordinates(
  offset: number,
  view: DataView,
): [Position, Position] {
  return [
    decodePosition(offset, view),
    decodePosition(offset + EncodedSize.position, view),
  ];
}

function encodeIdsList(ids: number[], offset: number, view: DataView): number {
  encodeNumber(ids.length, offset, view);
  ids.forEach((id, idx) => {
    encodeNumber(id, offset + DataSize.number + idx * DataSize.number, view);
  });

  return offset;
}

function getIdsListSize(data: number[] | string[]) {
  return DataSize.number + data.length * DataSize.number;
}

function decodeIdsList(offset: number, view: DataView): number[] {
  const ids: number[] = [];
  const count = decodeNumber(offset, view);

  for (let i = 0; i < count; i++) {
    const id = decodeNumber(
      offset + DataSize.number + i * DataSize.number,
      view,
    );
    ids.push(id);
  }

  return ids;
}

export class AssetsGeoEncoder {
  private nodesGeoBuilder: FixedSizeBufferBuilder<Position>;
  private linksGeoBuilder: FixedSizeBufferBuilder<BoundingBox>;
  private nodesSpatialIndexBuilder: GeoIndexBuilder;
  private segmentsGeoBuilder: FixedSizeBufferBuilder<[Position, Position]>;
  private segmentsLinkIndexBuilder: FixedSizeBufferBuilder<AssetId>;
  private linkSegmentsBuilder: VariableSizeBufferBuilder<SegmentId[]>;
  private segmmentsSpatialIndexBuilder: GeoIndexBuilder;

  constructor(
    private assetIndex: AssetIndexQueries,
    private assetsGeo: AssetsGeoQueries,
    private bufferType: BufferType = "array",
  ) {
    this.nodesGeoBuilder = new FixedSizeBufferBuilder(
      EncodedSize.position,
      this.assetIndex.nodeCount,
      bufferType,
      encodePosition,
    );
    this.nodesSpatialIndexBuilder = new GeoIndexBuilder(
      this.assetIndex.nodeCount,
    );
    this.linksGeoBuilder = new FixedSizeBufferBuilder(
      EncodedSize.bounds,
      this.assetIndex.linkCount,
      bufferType,
      encodeBounds,
    );

    this.segmentsGeoBuilder = new FixedSizeBufferBuilder(
      EncodedSize.position * 2,
      this.assetsGeo.segmentsCount,
      this.bufferType,
      encodeLineCoordinates,
    );
    this.segmentsLinkIndexBuilder = new FixedSizeBufferBuilder(
      DataSize.number,
      this.assetsGeo.segmentsCount,
      this.bufferType,
      encodeNumber,
    );
    this.linkSegmentsBuilder = new VariableSizeBufferBuilder(
      this.assetIndex.linkCount,
      this.assetsGeo.segmentsCount * DataSize.number +
        this.assetIndex.linkCount * DataSize.number,
      this.bufferType,
      encodeIdsList,
      getIdsListSize,
    );
    this.segmmentsSpatialIndexBuilder = new GeoIndexBuilder(
      this.assetsGeo.segmentsCount,
    );
  }

  encodeNode(id: AssetId, nodeIndex: number) {
    const position = this.assetsGeo.getNodePosition(id);
    if (!position) return;
    this.nodesGeoBuilder.addAtIndex(nodeIndex, position);
    this.nodesSpatialIndexBuilder.add([position, position]);
  }

  encodeLink(id: AssetId, linkIndex: number) {
    const bounds = this.assetsGeo.getLinkBounds(id);
    if (!bounds) return;
    this.linksGeoBuilder.addAtIndex(linkIndex, bounds);
    const linkSegments = this.assetsGeo.getLinkSegments(id);
    linkSegments.forEach(this.encodeLinkSegment.bind(this));
    this.linkSegmentsBuilder.add(linkSegments);
  }

  private encodeLinkSegment(segmentId: SegmentId) {
    const linkId = this.assetsGeo.getSegmentLinkId(segmentId);
    const coords = this.assetsGeo.getSegmentCoords(segmentId);
    const minX = Math.min(coords[0][0], coords[1][0]);
    const minY = Math.min(coords[0][1], coords[1][1]);
    const maxX = Math.max(coords[0][0], coords[1][0]);
    const maxY = Math.max(coords[0][1], coords[1][1]);
    this.segmentsLinkIndexBuilder.add(linkId);
    this.segmentsGeoBuilder.add(coords);
    this.segmmentsSpatialIndexBuilder.add([
      [minX, minY],
      [maxX, maxY],
    ]);
  }

  finalize(): AssetsGeoBuffers {
    return {
      nodesGeo: this.nodesGeoBuilder.finalize(),
      linksGeo: this.linksGeoBuilder.finalize(),
      segmentsGeo: this.segmentsGeoBuilder.finalize(),
      segmentsLinkIndex: this.segmentsLinkIndexBuilder.finalize(),
      nodesSpatialIndex: this.nodesSpatialIndexBuilder.finalize(),
      segmentsSpatialIndex: this.segmmentsSpatialIndexBuilder.finalize(),
      linkSegments: this.linkSegmentsBuilder.finalize(),
    };
  }
}

export class AssetsGeoView implements AssetsGeoQueries {
  private nodesGeo: FixedSizeBufferView<Position>;
  private linksGeo: FixedSizeBufferView<BoundingBox>;
  private segmentsGeo: FixedSizeBufferView<[Position, Position]>;
  private nodesSpatialIndex: Flatbush;
  private segmentsSpatialIndex: Flatbush;
  private segmentsLinkIndex: FixedSizeBufferView<AssetId>;
  private linkSegmentsIndex: VariableSizeBufferView<SegmentId[]>;

  constructor(
    buffers: AssetsGeoBuffers,
    private assetIndex: AssetIndexQueries,
  ) {
    this.nodesGeo = new FixedSizeBufferView(
      buffers.nodesGeo,
      EncodedSize.position,
      decodePosition,
    );
    this.linksGeo = new FixedSizeBufferView(
      buffers.linksGeo,
      EncodedSize.bounds,
      decodeBounds,
    );
    this.segmentsGeo = new FixedSizeBufferView(
      buffers.segmentsGeo,
      EncodedSize.position * 2,
      decodeLineCoordinates,
    );
    this.nodesSpatialIndex = Flatbush.from(buffers.nodesSpatialIndex);
    this.segmentsSpatialIndex = Flatbush.from(buffers.segmentsSpatialIndex);
    this.segmentsLinkIndex = new FixedSizeBufferView(
      buffers.segmentsLinkIndex,
      DataSize.number,
      decodeNumber,
    );
    this.linkSegmentsIndex = new VariableSizeBufferView(
      buffers.linkSegments,
      decodeIdsList,
    );
  }

  get segmentsCount(): number {
    return this.segmentsLinkIndex.count;
  }

  getNodePosition(id: AssetId): Position | undefined {
    const nodeIndex = this.assetIndex.getNodeIndex(id);
    if (nodeIndex === null) return;
    return this.nodesGeo.getById(nodeIndex);
  }

  getLinkBounds(id: AssetId): BoundingBox | undefined {
    const linkIndex = this.assetIndex.getLinkIndex(id);
    if (linkIndex === null) return;
    return this.linksGeo.getById(linkIndex);
  }

  getSegmentCoords(segmentId: SegmentId): [Position, Position] {
    if (segmentId >= this.segmentsLinkIndex.count)
      throw new Error(
        `Segment index out of bounds. Requested ${segmentId} but max is ${this.segmentsLinkIndex.count - 1}`,
      );

    return this.segmentsGeo.getById(segmentId);
  }

  getSegmentLinkId(segmentId: SegmentId): AssetId {
    if (segmentId >= this.segmentsLinkIndex.count)
      throw new Error(
        `Segment index out of bounds. Requested ${segmentId} but max is ${this.segmentsLinkIndex.count - 1}`,
      );

    return this.segmentsLinkIndex.getById(segmentId);
  }

  getLinkSegments(id: AssetId): SegmentId[] {
    const linkIndex = this.assetIndex.getLinkIndex(id);
    if (linkIndex === null) return [];
    return this.linkSegmentsIndex.getById(linkIndex);
  }

  searchNodes(bounds: BoundingBox, filterFn?: NodeFilterFn): AssetId[] {
    return this.nodesSpatialIndex
      .search(...bounds, (index: number, ...bounds: BoundingBox) => {
        if (!filterFn) return true;
        const nodeId = this.assetIndex.getNodeId(index)!;
        return filterFn(nodeId, bounds);
      })
      .map((nodeIndex) => this.assetIndex.getNodeId(nodeIndex)!);
  }

  searchLinkSegments(
    bounds: BoundingBox,
    filterFn?: SegmentFilterFn,
  ): SegmentId[] {
    return this.segmentsSpatialIndex.search(
      ...bounds,
      (index: number, ...bounds: BoundingBox) =>
        filterFn ? filterFn(index, bounds) : true,
    );
  }

  getNeighbouringNodes(
    pos: Position,
    maxCount: number,
    maxDistance: number,
  ): AssetId[] {
    const nodeIndexes = this.nodesSpatialIndex.neighbors(
      pos[0],
      pos[1],
      maxCount,
      maxDistance,
    );
    return nodeIndexes.map(
      (nodeIndex) => this.assetIndex.getNodeId(nodeIndex)!,
    );
  }
}
