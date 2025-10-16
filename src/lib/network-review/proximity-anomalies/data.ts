import { Pipe, AssetId } from "src/hydraulic-model/asset-types";
import { HydraulicModel } from "src/hydraulic-model";
import { Position } from "geojson";
import lineSegment from "@turf/line-segment";
import Flatbush from "flatbush";
import bbox from "@turf/bbox";
import { lineString } from "@turf/helpers";

export type BinaryData = ArrayBuffer | SharedArrayBuffer;

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

const UINT32_SIZE = 4;
const FLOAT64_SIZE = 8;
const COORDINATES_SIZE = 2 * FLOAT64_SIZE;
const BUFFER_HEADER_SIZE = UINT32_SIZE;
const NODE_BINARY_SIZE = UINT32_SIZE + COORDINATES_SIZE;
const LINK_BINARY_SIZE = UINT32_SIZE * 3;
const SEGMENT_BINARY_SIZE = UINT32_SIZE + COORDINATES_SIZE * 2;

export function encodeHydraulicModel(
  model: HydraulicModel,
  bufferType: "shared" | "array" = "array",
): EncodedHydraulicModel {
  const idsLookup: string[] = [];
  const idxLookup = new Map<string, number>(); // string ID → numeric index

  const getOrAssignIdx = (id: string) => {
    let idx = idxLookup.get(id);
    if (idx === undefined) {
      idx = idsLookup.length;
      idxLookup.set(id, idx);
      idsLookup.push(id);
    }
    return idx;
  };

  const nodes: { id: number; position: Position }[] = [];
  const links: { id: number; start: number; end: number }[] = [];
  const pipeSegments: {
    pipeId: number;
    startPosition: Position;
    endPosition: Position;
  }[] = [];

  for (const [id, asset] of model.assets) {
    const idx = getOrAssignIdx(id);

    if (asset.isLink) {
      const [startId, endId] = (asset as Pipe).connections;
      const start = getOrAssignIdx(startId);
      const end = getOrAssignIdx(endId);

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

  function encodeNodes(
    nodes: { id: number; position: Position }[],
  ): BinaryData {
    const recordSize = NODE_BINARY_SIZE;
    const totalSize = BUFFER_HEADER_SIZE + nodes.length * recordSize;
    const buffer =
      bufferType === "shared"
        ? new SharedArrayBuffer(totalSize)
        : new ArrayBuffer(totalSize);

    const view = new DataView(buffer);
    view.setUint32(0, nodes.length, true);
    nodes.forEach((n, i) => {
      let offset = UINT32_SIZE + i * recordSize;
      view.setUint32(offset, n.id, true);
      offset += UINT32_SIZE;
      encodeCoordinates([n.position], offset, view);
    });
    return buffer;
  }

  function encodeLinks(
    links: { id: number; start: number; end: number }[],
  ): BinaryData {
    const recordSize = LINK_BINARY_SIZE;
    const totalSize = BUFFER_HEADER_SIZE + links.length * recordSize;
    const buffer =
      bufferType === "shared"
        ? new SharedArrayBuffer(totalSize)
        : new ArrayBuffer(totalSize);

    const view = new DataView(buffer);
    view.setUint32(0, links.length, true);
    links.forEach((l, i) => {
      let offset = UINT32_SIZE + i * recordSize;
      view.setUint32(offset, l.id, true);
      offset += UINT32_SIZE;
      view.setUint32(offset, l.start, true);
      offset += UINT32_SIZE;
      view.setUint32(offset, l.end, true);
    });
    return buffer;
  }

  function encodePipeSegments(
    segments: {
      pipeId: number;
      startPosition: Position;
      endPosition: Position;
    }[],
  ): {
    buffer: BinaryData;
    geoIndex: BinaryData;
  } {
    const count = segments.length;
    const recordSize = SEGMENT_BINARY_SIZE;
    const totalSize = BUFFER_HEADER_SIZE + count * recordSize;
    const buffer =
      bufferType === "shared"
        ? new SharedArrayBuffer(totalSize)
        : new ArrayBuffer(totalSize);
    const geoIndex = new Flatbush(Math.max(count, 1));

    const view = new DataView(buffer);
    view.setUint32(0, segments.length, true);

    segments.forEach((segment, i) => {
      let offset = UINT32_SIZE + i * recordSize;
      view.setUint32(offset, segment.pipeId, true);
      offset += UINT32_SIZE;
      encodeCoordinates(
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

  function encodeCoordinates(
    coordinates: Position[],
    offset: number,
    view: DataView,
  ): void {
    coordinates.forEach((coord, i) => {
      const coordOffset = offset + i * COORDINATES_SIZE;
      view.setFloat64(coordOffset, coord[0], true);
      view.setFloat64(coordOffset + FLOAT64_SIZE, coord[1], true);
    });
  }

  const { buffer: pipeSegmentsBuffer, geoIndex: pipeSegmentsGeoIndex } =
    encodePipeSegments(pipeSegments);

  return {
    nodeBuffer: encodeNodes(nodes),
    linksBuffer: encodeLinks(links),
    pipeSegmentsBuffer,
    pipeSegmentsGeoIndex,
    idsLookup: idsLookup,
  };
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

    this.nodeCount = this.decodeCount(this.nodeView);
    this.linksCount = this.decodeCount(this.linksView);

    for (const [index, node] of this.enumerate(this.nodes())) {
      this.indexedNodes.set(node.id, index);
    }

    for (const [index, link] of this.enumerate(this.links())) {
      this.indexedLinks.set(link.id, index);
    }
  }

  *nodes(): Generator<Node> {
    for (let i = 0; i < this.nodeCount; i++) {
      yield this.decodeNode(this.nodeView, i);
    }
  }

  *links(): Generator<Link> {
    for (let i = 0; i < this.linksCount; i++) {
      yield this.decodeLink(this.linksView, i);
    }
  }

  getNodeByIndex(index: number): Node | null {
    const nodeIndex = this.indexedNodes.get(index);
    if (nodeIndex === undefined) return null;
    return this.decodeNode(this.nodeView, nodeIndex);
  }

  private decodeCount(view: DataView): number {
    return view.getUint32(0, true);
  }

  private decodeNode(view: DataView, index: number): Node {
    let offset = BUFFER_HEADER_SIZE + index * NODE_BINARY_SIZE;
    const id = view.getUint32(offset, true);
    offset += UINT32_SIZE;
    const position: Position = [
      view.getFloat64(offset, true),
      view.getFloat64(offset + FLOAT64_SIZE, true),
    ];
    return { id, position };
  }

  private decodeLink(view: DataView, index: number): Link {
    let offset = BUFFER_HEADER_SIZE + index * LINK_BINARY_SIZE;
    const id = view.getUint32(offset, true);
    offset += UINT32_SIZE;
    const startNode = view.getUint32(offset, true);
    offset += UINT32_SIZE;
    const endNode = view.getUint32(offset, true);
    return {
      id,
      startNode,
      endNode,
    };
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
    this.count = this.decodeCount(this.view);
  }

  private decodeCount(view: DataView): number {
    return view.getUint32(0, true);
  }

  getId(index: number): number {
    const id = this.view.getUint32(
      BUFFER_HEADER_SIZE + index * SEGMENT_BINARY_SIZE,
      true,
    );
    return id;
  }

  getCoordinates(index: number): [Position, Position] {
    const offset =
      BUFFER_HEADER_SIZE + index * SEGMENT_BINARY_SIZE + UINT32_SIZE;
    const startPosition: Position = [
      this.view.getFloat64(offset, true),
      this.view.getFloat64(offset + FLOAT64_SIZE, true),
    ];
    const endPosition: Position = [
      this.view.getFloat64(offset + COORDINATES_SIZE, true),
      this.view.getFloat64(offset + COORDINATES_SIZE + FLOAT64_SIZE, true),
    ];
    return [startPosition, endPosition];
  }
}
