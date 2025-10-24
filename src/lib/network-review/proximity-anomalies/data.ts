import { Pipe, AssetId } from "src/hydraulic-model/asset-types";
import { HydraulicModel } from "src/hydraulic-model";
import { Position } from "geojson";
import lineSegment from "@turf/line-segment";
import Flatbush from "flatbush";
import bbox from "@turf/bbox";
import { lineString } from "@turf/helpers";
import {
  BinaryData,
  BufferType,
  IdMapper,
  DataSize,
  createBuffer,
  encodeCount,
  decodeCount,
  encodePosition,
  decodePosition,
  encodeLineCoordinates,
  encodeId,
  decodeId,
  encodeLink,
  decodeLink,
} from "../shared";

export type EncodedHydraulicModel = {
  nodeBuffer: BinaryData;
  linksBuffer: BinaryData;
  pipeSegmentsBuffer: BinaryData;
  pipeSegmentsGeoIndex: BinaryData;
  idsLookup: string[];
};

export type RunData = Omit<EncodedHydraulicModel, "idsLookup">;

interface EncodedProximityAnomaly {
  nodeId: number;
  connection: EncodedAlternativeConnection;
}

export type EncodedProximityAnomalies = EncodedProximityAnomaly[];

export interface EncodedAlternativeConnection {
  pipeId: number;
  distance: number;
  nearestPointOnPipe: Position;
}

export interface ProximityAnomaly {
  nodeId: AssetId;
  pipeId: AssetId;
  distance: number;
  nearestPointOnPipe: Position;
}

const NODE_BINARY_SIZE = DataSize.id + DataSize.position;
const LINK_BINARY_SIZE = DataSize.id * 3;
const SEGMENT_BINARY_SIZE = DataSize.id + DataSize.position * 2;

export function encodeHydraulicModel(
  model: HydraulicModel,
  bufferType: BufferType = "array",
): EncodedHydraulicModel {
  const idMapper = new IdMapper();

  const nodes: { id: number; position: Position }[] = [];
  const links: { id: number; start: number; end: number }[] = [];
  const pipeSegments: {
    pipeId: number;
    startPosition: Position;
    endPosition: Position;
  }[] = [];

  for (const [id, asset] of model.assets) {
    const idx = idMapper.getOrAssignIdx(id);

    if (asset.isLink) {
      const [startId, endId] = (asset as Pipe).connections;
      const start = idMapper.getOrAssignIdx(startId);
      const end = idMapper.getOrAssignIdx(endId);

      links.push({ id: idx, start, end });
      if (
        asset.type === "pipe" &&
        asset.feature.geometry.type === "LineString"
      ) {
        const pipeFeature = {
          type: "Feature" as const,
          geometry: asset.feature.geometry,
          properties: {},
        };
        const segments = lineSegment(pipeFeature);
        for (const segment of segments.features) {
          const [startPosition, endPosition] = segment.geometry.coordinates;
          pipeSegments.push({ pipeId: idx, startPosition, endPosition });
        }
      }
    } else {
      const geometry = asset.feature.geometry as GeoJSON.Point;
      nodes.push({
        id: idx,
        position: geometry.coordinates,
      });
    }
  }

  const { buffer: pipeSegmentsBuffer, geoIndex: pipeSegmentsGeoIndex } =
    encodePipeSegmentsBuffer(pipeSegments, bufferType);

  return {
    nodeBuffer: encodeNodesBuffer(nodes, bufferType),
    linksBuffer: encodeLinksBuffer(links, bufferType),
    pipeSegmentsBuffer,
    pipeSegmentsGeoIndex,
    idsLookup: idMapper.getIdsLookup(),
  };
}

function encodeNodesBuffer(
  nodes: { id: number; position: Position }[],
  bufferType: BufferType,
): BinaryData {
  const recordSize = NODE_BINARY_SIZE;
  const totalSize = DataSize.count + nodes.length * recordSize;
  const buffer = createBuffer(totalSize, bufferType);

  const view = new DataView(buffer);
  encodeCount(view, nodes.length);
  nodes.forEach((n, i) => {
    let offset = DataSize.count + i * recordSize;
    encodeId(n.id, offset, view);
    offset += DataSize.id;
    encodePosition(n.position, offset, view);
  });
  return buffer;
}

function encodeLinksBuffer(
  links: { id: number; start: number; end: number }[],
  bufferType: BufferType,
): BinaryData {
  const recordSize = LINK_BINARY_SIZE;
  const totalSize = DataSize.count + links.length * recordSize;
  const buffer = createBuffer(totalSize, bufferType);

  const view = new DataView(buffer);
  encodeCount(view, links.length);
  links.forEach((l, i) => {
    const offset = DataSize.count + i * recordSize;
    encodeLink(offset, view, l.id, l.start, l.end);
  });
  return buffer;
}

function encodePipeSegmentsBuffer(
  segments: {
    pipeId: number;
    startPosition: Position;
    endPosition: Position;
  }[],
  bufferType: BufferType,
): {
  buffer: BinaryData;
  geoIndex: BinaryData;
} {
  const count = segments.length;
  const recordSize = SEGMENT_BINARY_SIZE;
  const totalSize = DataSize.count + count * recordSize;
  const buffer = createBuffer(totalSize, bufferType);
  const geoIndex = new Flatbush(Math.max(count, 1));

  const view = new DataView(buffer);
  encodeCount(view, segments.length);

  segments.forEach((segment, i) => {
    let offset = DataSize.count + i * recordSize;
    encodeId(segment.pipeId, offset, view);
    offset += DataSize.id;
    encodeLineCoordinates(
      [segment.startPosition, segment.endPosition],
      offset,
      view,
    );

    const [minX, minY, maxX, maxY] = bbox(
      lineString([segment.startPosition, segment.endPosition]),
    );
    geoIndex.add(minX, minY, maxX, maxY);
  });

  if (count === 0) {
    geoIndex.add(0, 0, 0, 0);
  }

  geoIndex.finish();

  return { buffer, geoIndex: geoIndex.data };
}

export function decodeProximityAnomalies(
  model: HydraulicModel,
  idsLookup: string[],
  encodedProximityAnomalies: EncodedProximityAnomaly[],
): ProximityAnomaly[] {
  const proximityAnomalies: ProximityAnomaly[] = [];

  encodedProximityAnomalies.forEach((encoded) => {
    const nodeId = idsLookup[encoded.nodeId];
    const connection = encoded.connection;
    const pipeId = idsLookup[connection.pipeId];
    const pipeAsset = model.assets.get(pipeId);
    if (pipeAsset && pipeAsset.type === "pipe") {
      proximityAnomalies.push({
        nodeId,
        pipeId,
        distance: connection.distance,
        nearestPointOnPipe: connection.nearestPointOnPipe,
      });
    }
  });

  return proximityAnomalies.sort((a: ProximityAnomaly, b: ProximityAnomaly) => {
    const nodeA = model.assets.get(a.nodeId);
    const nodeB = model.assets.get(b.nodeId);
    const labelA = nodeA ? nodeA.label.toUpperCase() : a.nodeId.toUpperCase();
    const labelB = nodeB ? nodeB.label.toUpperCase() : b.nodeId.toUpperCase();

    if (a.distance < b.distance) return -1;
    if (a.distance > b.distance) return 1;
    if (labelA < labelB) return -1;
    if (labelA > labelB) return 1;
    return 0;
  });
}

export interface Node {
  id: number;
  position: Position;
}

export interface Link {
  id: number;
  startNode: number;
  endNode: number;
}

export class TopologyBufferView {
  private nodeView: DataView;
  private linksView: DataView;

  readonly nodeCount: number;
  readonly linksCount: number;

  private indexedNodes: Map<number, number> = new Map();
  private indexedLinks: Map<number, number> = new Map();

  constructor(
    public readonly nodeBuffer: BinaryData,
    public readonly linksBuffer: BinaryData,
  ) {
    this.nodeView = new DataView(nodeBuffer);
    this.linksView = new DataView(linksBuffer);

    this.nodeCount = decodeCount(this.nodeView);
    this.linksCount = decodeCount(this.linksView);

    for (const [index, node] of this.enumerate(this.nodes())) {
      this.indexedNodes.set(node.id, index);
    }

    for (const [index, link] of this.enumerate(this.links())) {
      this.indexedLinks.set(link.id, index);
    }
  }

  *nodes(): Generator<Node> {
    for (let i = 0; i < this.nodeCount; i++) {
      let offset = DataSize.count + i * NODE_BINARY_SIZE;
      const id = decodeId(offset, this.nodeView);
      offset += DataSize.id;
      const position = decodePosition(offset, this.nodeView);
      yield { id, position };
    }
  }

  *links(): Generator<Link> {
    for (let i = 0; i < this.linksCount; i++) {
      const offset = DataSize.count + i * LINK_BINARY_SIZE;
      const link = decodeLink(offset, this.linksView);
      yield link;
    }
  }

  getNodeByIndex(index: number): Node | null {
    const nodeIndex = this.indexedNodes.get(index);
    if (nodeIndex === undefined) return null;
    let offset = DataSize.count + nodeIndex * NODE_BINARY_SIZE;
    const id = decodeId(offset, this.nodeView);
    offset += DataSize.id;
    const position = decodePosition(offset, this.nodeView);
    return { id, position };
  }

  private *enumerate<T>(iterable: Iterable<T>): Generator<[number, T]> {
    let i = 0;
    for (const item of iterable) {
      yield [i++, item];
    }
  }
}

export class SegmentsGeometriesBufferView {
  private view: DataView;
  readonly count: number;

  constructor(public readonly buffer: BinaryData) {
    this.view = new DataView(buffer);
    this.count = decodeCount(this.view);
  }

  getId(index: number): number {
    return decodeId(DataSize.count + index * SEGMENT_BINARY_SIZE, this.view);
  }

  getCoordinates(index: number): [Position, Position] {
    let offset = DataSize.count + index * SEGMENT_BINARY_SIZE + DataSize.id;
    const startPosition = decodePosition(offset, this.view);
    offset += DataSize.position;
    const endPosition = decodePosition(offset, this.view);
    return [startPosition, endPosition];
  }
}
