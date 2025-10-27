import { HydraulicModel } from "src/hydraulic-model";
import {
  Asset,
  AssetType,
  LinkType,
  NodeType,
  Pipe,
} from "src/hydraulic-model/asset-types";
import { Position } from "geojson";
import bbox from "@turf/bbox";
import lineSegment from "@turf/line-segment";

import { GeoIndexBuilder } from "./geo-buffer";
import { IdMapper } from "./id-mapper";
import { BufferType, NetworkReviewBuffers } from "./types";
import {
  DataSize,
  decodeDecimal,
  decodeNumber,
  encodeDecimal,
  encodeNumber,
  encodeType,
  FixedSizeBufferBuilder,
  VariableSizeBufferBuilder,
} from "./buffers";

type EncodingOptions = {
  nodes?: Set<"connections" | "types" | "geoIndex" | "bounds">;
  links?: Set<"connections" | "types" | "geoIndex" | "bounds">;
  bufferType: BufferType;
};

export const EncodedSize = {
  id: DataSize.number,
  count: DataSize.number,
  type: DataSize.type,
  coordinate: DataSize.decimal,
  position: DataSize.decimal * 2,
  bounds: DataSize.decimal * 4,
} as const;

export class HydraulicModelEncoder {
  private nodeIdMapper = new IdMapper();
  private linkIdMapper = new IdMapper();
  private pipeSegmentCount = 0;
  private totalConnectionsSize = 0;
  private pipeSegmentsCache: {
    startPosition: Position;
    endPosition: Position;
  }[][] = [];
  private nodeConnectionsCache = new Map<string, string[]>();

  constructor(
    private model: HydraulicModel,
    private encodingOptions: EncodingOptions,
  ) {}

  buildBuffers(): NetworkReviewBuffers {
    this.prepareMappings();
    const {
      nodePositions,
      nodeTypes,
      nodeConnections,
      nodeGeoIndex,
      linkConnections,
      linkBounds,
      linkTypes,
      pipeSegmentIds,
      pipeSegmentCoordinates,
      pipeSegmentsGeoIndex,
    } = this.buildEmptyBuffers();

    this.encodeLinks(
      linkConnections,
      linkBounds,
      linkTypes,
      pipeSegmentIds,
      pipeSegmentCoordinates,
      pipeSegmentsGeoIndex,
    );
    this.encodeNodes(nodePositions, nodeTypes, nodeConnections, nodeGeoIndex);

    return {
      links: {
        connections: linkConnections.finalize(),
        bounds: linkBounds.finalize(),
        types: linkTypes.finalize(),
      },
      nodes: {
        positions: nodePositions.finalize(),
        types: nodeTypes.finalize(),
        connections: nodeConnections.finalize(),
        geoIndex: nodeGeoIndex.finalize(),
      },
      pipeSegments: {
        ids: pipeSegmentIds.finalize(),
        coordinates: pipeSegmentCoordinates.finalize(),
        geoIndex: pipeSegmentsGeoIndex.finalize(),
      },
      nodeIdsLookup: this.nodeIdMapper.getIdsLookup(),
      linkIdsLookup: this.linkIdMapper.getIdsLookup(),
    };
  }

  private prepareMappings() {
    for (const [id, asset] of this.model.assets) {
      if (asset.isLink) {
        this.linkIdMapper.getOrAssignIdx(id);
        this.prepareSegmentsEncoding(asset);
      } else {
        this.nodeIdMapper.getOrAssignIdx(id);
        this.prepareNodeConnectionsEncoding(asset, id);
      }
    }
  }

  private prepareSegmentsEncoding(asset: Asset) {
    if (this.encodingOptions.links?.has("geoIndex") !== true) {
      return;
    }

    if (!asset.isLink) {
      return;
    }

    if (asset.type === "pipe" && asset.feature.geometry.type === "LineString") {
      const segments = lineSegment(asset.feature.geometry);
      const segmentsData = segments.features.map((segment) => {
        const [startPosition, endPosition] = segment.geometry.coordinates;
        return { startPosition, endPosition };
      });
      this.pipeSegmentsCache.push(segmentsData);
      this.pipeSegmentCount += segmentsData.length;
    } else {
      this.pipeSegmentsCache.push([]);
    }
  }

  private prepareNodeConnectionsEncoding(asset: Asset, id: string) {
    if (this.encodingOptions.nodes?.has("connections") !== true) {
      return;
    }

    if (asset.isLink) {
      return;
    }

    const connectedLinkIds = this.model.topology.getLinks(id);
    this.nodeConnectionsCache.set(id, connectedLinkIds);
    this.totalConnectionsSize += getIdsListSize(connectedLinkIds);
  }

  private buildEmptyBuffers() {
    const nodePositions = new FixedSizeBufferBuilder(
      EncodedSize.position,
      this.encodingOptions.nodes?.has("bounds") ? this.nodeIdMapper.count : 0,
      this.encodingOptions.bufferType,
      encodePosition,
    );
    const nodeTypes = new FixedSizeBufferBuilder(
      DataSize.type,
      this.encodingOptions.nodes?.has("types") ? this.nodeIdMapper.count : 0,
      this.encodingOptions.bufferType,
      encodeType,
    );
    const nodeConnections = new VariableSizeBufferBuilder(
      this.encodingOptions.nodes?.has("connections")
        ? this.nodeIdMapper.count
        : 0,
      this.totalConnectionsSize,
      this.encodingOptions.bufferType,
      encodeIdsList,
      getIdsListSize,
    );
    const nodeGeoIndex = new GeoIndexBuilder(
      this.encodingOptions.nodes?.has("geoIndex") ? this.nodeIdMapper.count : 0,
    );

    const linkConnections = new FixedSizeBufferBuilder<[number, number]>(
      EncodedSize.id * 2,
      this.encodingOptions.links?.has("connections")
        ? this.linkIdMapper.count
        : 0,
      this.encodingOptions.bufferType,
      encodeLinkConnections,
    );
    const linkBounds = new FixedSizeBufferBuilder(
      EncodedSize.bounds,
      this.encodingOptions.links?.has("bounds") ? this.linkIdMapper.count : 0,
      this.encodingOptions.bufferType,
      encodeBounds,
    );
    const linkTypes = new FixedSizeBufferBuilder(
      DataSize.type,
      this.encodingOptions.links?.has("types") ? this.linkIdMapper.count : 0,
      this.encodingOptions.bufferType,
      encodeType,
    );

    const pipeSegmentIds = new FixedSizeBufferBuilder(
      EncodedSize.id,
      this.pipeSegmentCount,
      this.encodingOptions.bufferType,
      encodeId,
    );
    const pipeSegmentCoordinates = new FixedSizeBufferBuilder(
      EncodedSize.position * 2,
      this.pipeSegmentCount,
      this.encodingOptions.bufferType,
      encodeLineCoordinates,
    );
    const pipeSegmentsGeoIndex = new GeoIndexBuilder(this.pipeSegmentCount);

    return {
      nodePositions,
      nodeTypes,
      nodeConnections,
      nodeGeoIndex,
      linkConnections,
      linkBounds,
      linkTypes,
      pipeSegmentIds,
      pipeSegmentCoordinates,
      pipeSegmentsGeoIndex,
    };
  }

  private encodeLinks(
    linkConnections: FixedSizeBufferBuilder<[number, number]>,
    linkBounds: FixedSizeBufferBuilder<[number, number, number, number]>,
    linkTypes: FixedSizeBufferBuilder<number>,
    pipeSegmentIds: FixedSizeBufferBuilder<number>,
    pipeSegmentCoordinates: FixedSizeBufferBuilder<[Position, Position]>,
    pipeSegmentsGeoIndex: GeoIndexBuilder,
  ) {
    for (let linkIdx = 0; linkIdx < this.linkIdMapper.count; linkIdx++) {
      const id = this.linkIdMapper.getId(linkIdx) ?? "";
      const asset = this.model.assets.get(id)!;

      this.encodeLinkConnections(asset, linkConnections);
      this.encodeLinkType(asset, linkTypes);
      this.encodeLinkBounds(asset, linkBounds);
      this.encodePipeSegments(
        linkIdx,
        pipeSegmentIds,
        pipeSegmentCoordinates,
        pipeSegmentsGeoIndex,
      );
    }
  }

  private encodeLinkConnections(
    asset: Asset,
    linkConnections: FixedSizeBufferBuilder<[number, number]>,
  ) {
    if (this.encodingOptions.links?.has("connections") !== true) {
      return;
    }

    const [startId, endId] = (asset as Pipe).connections;
    const start = this.nodeIdMapper.getIdx(startId);
    const end = this.nodeIdMapper.getIdx(endId);
    linkConnections.add([start, end]);
  }

  private encodeLinkType(
    asset: Asset,
    linkTypes: FixedSizeBufferBuilder<number>,
  ) {
    if (this.encodingOptions.links?.has("types") !== true) {
      return;
    }

    const linkTypeId = toLinkTypeId(asset.type);
    linkTypes.add(linkTypeId);
  }

  private encodeLinkBounds(
    asset: Asset,
    linkBounds: FixedSizeBufferBuilder<[number, number, number, number]>,
  ) {
    if (this.encodingOptions.links?.has("bounds") !== true) {
      return;
    }
    const [minX, minY, maxX, maxY] = bbox(asset.feature);
    linkBounds.add([minX, minY, maxX, maxY]);
  }

  private encodePipeSegments(
    linkIdx: number,
    pipeSegmentIds: FixedSizeBufferBuilder<number>,
    pipeSegmentCoordinates: FixedSizeBufferBuilder<[Position, Position]>,
    pipeSegmentsGeoIndex: GeoIndexBuilder,
  ) {
    if (this.encodingOptions.links?.has("geoIndex") !== true) {
      return;
    }

    const segments = this.pipeSegmentsCache[linkIdx];
    for (const { startPosition, endPosition } of segments) {
      pipeSegmentIds.add(linkIdx);
      pipeSegmentCoordinates.add([startPosition, endPosition]);
      pipeSegmentsGeoIndex.add([startPosition, endPosition]);
    }
  }

  private encodeNodes(
    nodePositions: FixedSizeBufferBuilder<Position>,
    nodeTypes: FixedSizeBufferBuilder<number>,
    nodeConnections: VariableSizeBufferBuilder<number[]>,
    nodeGeoIndex: GeoIndexBuilder,
  ) {
    for (let nodeIdx = 0; nodeIdx < this.nodeIdMapper.count; nodeIdx++) {
      const id = this.nodeIdMapper.getId(nodeIdx) ?? "";
      const asset = this.model.assets.get(id)!;

      this.encodeNodeType(asset, nodeTypes);
      this.encodeNodeConnections(id, nodeConnections);
      this.encodeNodePosition(asset, nodePositions);
      this.encodeNodeGeoIndex(asset, nodeGeoIndex);
    }
  }

  private encodeNodeType(
    asset: Asset,
    nodeTypes: FixedSizeBufferBuilder<number>,
  ) {
    if (this.encodingOptions.nodes?.has("types") !== true) {
      return;
    }

    const nodeTypeId = toNodeTypeId(asset.type);
    nodeTypes.add(nodeTypeId);
  }

  private encodeNodeConnections(
    id: string,
    nodeConnections: VariableSizeBufferBuilder<number[]>,
  ) {
    if (this.encodingOptions.nodes?.has("connections") !== true) {
      return;
    }
    const connectedLinkIds = this.nodeConnectionsCache.get(id) ?? [];
    const connectedLinkIdxs = connectedLinkIds.map((linkId) =>
      this.linkIdMapper.getIdx(linkId),
    );

    nodeConnections.add(connectedLinkIdxs);
  }

  private encodeNodePosition(
    asset: Asset,
    nodePositions: FixedSizeBufferBuilder<Position>,
  ) {
    if (this.encodingOptions.nodes?.has("bounds") !== true) {
      return;
    }
    const geometry = asset.feature.geometry as GeoJSON.Point;
    nodePositions.add(geometry.coordinates);
  }

  private encodeNodeGeoIndex(asset: Asset, nodeGeoIndex: GeoIndexBuilder) {
    if (this.encodingOptions.nodes?.has("geoIndex") !== true) {
      return;
    }
    const geometry = asset.feature.geometry as GeoJSON.Point;
    nodeGeoIndex.add([geometry.coordinates]);
  }
}

const NODE_TYPE_MAP = { junction: 0, tank: 1, reservoir: 2 } as const;

const NODE_TYPE_REVERSE_MAP: Record<number, NodeType> = {
  0: "junction",
  1: "tank",
  2: "reservoir",
} as const;

export function toNodeTypeId(type: AssetType) {
  return NODE_TYPE_MAP[type as keyof typeof NODE_TYPE_MAP] ?? 0;
}

export function toNodeType(typeId: number): NodeType {
  return NODE_TYPE_REVERSE_MAP[typeId] ?? "junction";
}

const LINK_TYPE_MAP = { pipe: 0, valve: 1, pump: 2 } as const;

const LINK_TYPE_REVERSE_MAP: Record<number, LinkType> = {
  0: "pipe",
  1: "valve",
  2: "pump",
} as const;

export function toLinkTypeId(type: AssetType) {
  return LINK_TYPE_MAP[type as keyof typeof LINK_TYPE_MAP] ?? 0;
}

export function toLinkType(typeId: number): LinkType {
  return LINK_TYPE_REVERSE_MAP[typeId] ?? "pipe";
}

export function encodePosition(
  position: Position,
  offset: number,
  view: DataView,
): void {
  encodeDecimal(position[0], offset, view);
  encodeDecimal(position[1], offset + DataSize.decimal, view);
}

export function decodePosition(offset: number, view: DataView): Position {
  return [
    decodeDecimal(offset, view),
    decodeDecimal(offset + DataSize.decimal, view),
  ];
}

export const encodeId = (id: number, offset: number, view: DataView) =>
  encodeNumber(id, offset, view);

export const decodeId = (offset: number, view: DataView) =>
  decodeNumber(offset, view);

export function encodeBounds(
  bounds: [number, number, number, number],
  offset: number,
  view: DataView,
): void {
  encodePosition([bounds[0], bounds[1]], offset, view);
  encodePosition([bounds[2], bounds[3]], offset + EncodedSize.position, view);
}

export function decodeBounds(
  offset: number,
  view: DataView,
): [number, number, number, number] {
  const [minX, minY] = decodePosition(offset, view);
  const [maxX, maxY] = decodePosition(offset + EncodedSize.position, view);
  return [minX, minY, maxX, maxY];
}

export function encodeLineCoordinates(
  positions: [Position, Position],
  offset: number,
  view: DataView,
): void {
  encodePosition(positions[0], offset, view);
  encodePosition(positions[1], offset + EncodedSize.position, view);
}

export function decodeLineCoordinates(
  offset: number,
  view: DataView,
): [Position, Position] {
  return [
    decodePosition(offset, view),
    decodePosition(offset + EncodedSize.position, view),
  ];
}

export function encodeIdsList(
  connectedLinkIds: number[],
  offset: number,
  view: DataView,
): number {
  encodeNumber(connectedLinkIds.length, offset, view);
  connectedLinkIds.forEach((linkId, idx) => {
    encodeId(linkId, offset + EncodedSize.count + idx * EncodedSize.id, view);
  });

  return offset;
}

export function getIdsListSize(data: number[] | string[]) {
  return EncodedSize.count + data.length * EncodedSize.id;
}

export function decodeIdsList(offset: number, view: DataView): number[] {
  const ids: number[] = [];
  const count = decodeNumber(offset, view);

  for (let i = 0; i < count; i++) {
    const id = decodeId(offset + EncodedSize.count + i * EncodedSize.id, view);
    ids.push(id);
  }

  return ids;
}

export function encodeLinkConnections(
  connections: [number, number],
  offset: number,
  view: DataView,
) {
  encodeId(connections[0], offset, view);
  encodeId(connections[1], offset + EncodedSize.id, view);
}

export function decodeLinkConnections(
  offset: number,
  view: DataView,
): [number, number] {
  return [decodeId(offset, view), decodeId(offset + EncodedSize.id, view)];
}

export function encodeLink(
  offset: number,
  view: DataView,
  id: number,
  start: number,
  end: number,
): void {
  encodeId(id, offset, view);
  encodeId(start, offset + EncodedSize.id, view);
  encodeId(end, offset + 2 * EncodedSize.id, view);
}

export function decodeLink(
  offset: number,
  view: DataView,
): { id: number; startNode: number; endNode: number } {
  return {
    id: decodeId(offset, view),
    startNode: decodeId(offset + EncodedSize.id, view),
    endNode: decodeId(offset + 2 * EncodedSize.id, view),
  };
}

export const encodeNodeId = (offset: number, view: DataView, id: number) =>
  encodeId(id, offset, view);
export const decodeNodeId = decodeId;
