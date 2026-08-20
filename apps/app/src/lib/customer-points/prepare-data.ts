import { LineString, Feature, Position } from "@turf/helpers";
import lineSegment from "@turf/line-segment";
import bbox from "@turf/bbox";
import Flatbush from "flatbush";
import { addPlaceholderMatchingNoSearch } from "@epanet-js/buffers";
import {
  AssetId,
  AssetsMap,
  Pipe,
  NodeAsset,
  NodeType,
  CustomerPoint,
} from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "../../hydraulic-model/hydraulic-model";
import type { MultiPolygon } from "geojson";
import {
  BinaryData,
  RunData,
  NODE_TYPE_TO_ENUM,
  BUFFER_HEADER_SIZE,
  PIPE_SEGMENT_BINARY_SIZE,
  PIPE_BINARY_SIZE,
  NODE_BINARY_SIZE,
  CUSTOMER_POINT_BINARY_SIZE,
  UINT32_SIZE,
  FLOAT64_SIZE,
  FLATBUSH_NODE_SIZE,
} from "./run-data";

export * from "./run-data";

export interface LinkSegmentProperties {
  linkId: number;
}

export type LinkSegment = Feature<LineString, LinkSegmentProperties>;

export const prepareWorkerData = (
  hydraulicModel: HydraulicModel,
  customerPoints: CustomerPoint[],
  bufferType: "shared" | "array" = "array",
  zoneGeometry?: MultiPolygon,
  selectedPipes?: Set<AssetId>,
): RunData => {
  const { pipesIndex, pipesCount, pipeSegmentsCount, nodesIndex, nodesCount } =
    generateAssetIndexes(hydraulicModel.assets, selectedPipes);

  const customerPointsCount = customerPoints.length;

  const BufferConstructor =
    bufferType === "shared" ? SharedArrayBuffer : ArrayBuffer;

  const pipeSegmentsBuilder = new PipeSegmentsBinaryBuilder(
    pipeSegmentsCount,
    pipesIndex,
    bufferType,
  );
  const pipesBuilder = new PipesBinaryBuilder(
    pipesCount,
    pipesIndex,
    nodesIndex,
    bufferType,
  );
  const nodesBuilder = new NodesBinaryBuilder(
    nodesCount,
    nodesIndex,
    bufferType,
  );
  const customerPointsBuilder = new CustomerPointsBinaryBuilder(
    customerPointsCount,
    bufferType,
  );

  // Flatbush requires at least 1 item, so we use a placeholder when no pipe segments exist
  const pipeSegmentsForIndex = Math.max(pipeSegmentsCount, 1);
  const spatialIndex = new Flatbush(
    pipeSegmentsForIndex,
    FLATBUSH_NODE_SIZE,
    Float64Array,
    BufferConstructor,
  );

  for (const pipeId of pipesIndex.keys()) {
    const pipe = hydraulicModel.assets.get(pipeId) as Pipe;
    const [startNodeId, endNodeId] = pipe.connections;
    pipesBuilder.addPipe(pipe.id, pipe.diameter ?? 0, startNodeId, endNodeId);

    if (pipe.feature.geometry.type === "LineString") {
      const pipeFeature = {
        type: "Feature" as const,
        geometry: pipe.feature.geometry as LineString,
        properties: {},
      };
      const pipeSegments = lineSegment(pipeFeature);
      for (const pipeSegment of pipeSegments.features) {
        const coordinates = pipeSegment.geometry.coordinates;
        pipeSegmentsBuilder.addPipeSegment(coordinates, pipe.id);

        const [minX, minY, maxX, maxY] = bbox(pipeSegment);
        spatialIndex.add(minX, minY, maxX, maxY);
      }
    }
  }

  for (const nodeId of nodesIndex.keys()) {
    const node = hydraulicModel.assets.get(nodeId) as NodeAsset;
    nodesBuilder.addNode(node.id, node.coordinates, node.type as NodeType);
  }

  let addedCustomerPoints = 0;
  for (let i = 0; i < customerPoints.length; i++) {
    const customerPoint = customerPoints[i];

    customerPointsBuilder.addCustomerPoint(
      customerPoint.id,
      customerPoint.coordinates,
      addedCustomerPoints,
    );
    addedCustomerPoints++;
  }
  customerPointsBuilder.updateCount(addedCustomerPoints);

  if (pipeSegmentsCount === 0) {
    addPlaceholderMatchingNoSearch(spatialIndex);
  }

  spatialIndex.finish();

  let zoneGeometryBuffer: BinaryData | undefined;
  if (zoneGeometry) {
    const zoneBuilder = new ZoneGeometryBinaryBuilder(zoneGeometry, bufferType);
    for (const polygon of zoneGeometry.coordinates) {
      zoneBuilder.addPolygon(polygon);
    }
    zoneGeometryBuffer = zoneBuilder.build();
  }

  return {
    flatbushIndex: spatialIndex.data as BinaryData,
    pipeSegments: pipeSegmentsBuilder.build(),
    pipes: pipesBuilder.build(),
    nodes: nodesBuilder.build(),
    customerPoints: customerPointsBuilder.build(),
    zoneGeometry: zoneGeometryBuffer,
  };
};

class PipeSegmentsBinaryBuilder {
  private buffer: BinaryData;
  private view: DataView;
  private pipeSegmentIndex: number = 0;

  constructor(
    segmentCount: number,
    private pipesIndex: Map<number, number>,
    private bufferType: "shared" | "array" = "array",
  ) {
    const totalSize =
      BUFFER_HEADER_SIZE + segmentCount * PIPE_SEGMENT_BINARY_SIZE;
    this.buffer =
      this.bufferType === "shared"
        ? new SharedArrayBuffer(totalSize)
        : new ArrayBuffer(totalSize);
    this.view = new DataView(this.buffer);

    let offset = 0;
    this.view.setUint32(offset, segmentCount, true);
    offset += UINT32_SIZE;
    this.view.setUint32(offset, 0, true);
  }

  addPipeSegment(coordinates: Position[], pipeId: number): void {
    const pipeIndex = this.pipesIndex.get(pipeId)!;
    let offset =
      BUFFER_HEADER_SIZE + this.pipeSegmentIndex * PIPE_SEGMENT_BINARY_SIZE;

    this.view.setUint32(offset, pipeIndex, true);
    offset += UINT32_SIZE;

    for (const coord of coordinates) {
      this.view.setFloat64(offset, coord[0], true);
      offset += FLOAT64_SIZE;
      this.view.setFloat64(offset, coord[1], true);
      offset += FLOAT64_SIZE;
    }

    this.pipeSegmentIndex++;
  }

  build(): BinaryData {
    return this.buffer;
  }
}

class PipesBinaryBuilder {
  private buffer: BinaryData;
  private view: DataView;

  constructor(
    pipeCount: number,
    private pipesIndex: Map<number, number>,
    private nodesIndex: Map<number, number>,
    private bufferType: "shared" | "array" = "array",
  ) {
    const totalSize = BUFFER_HEADER_SIZE + pipeCount * PIPE_BINARY_SIZE;
    this.buffer =
      this.bufferType === "shared"
        ? new SharedArrayBuffer(totalSize)
        : new ArrayBuffer(totalSize);
    this.view = new DataView(this.buffer);

    let offset = 0;
    this.view.setUint32(offset, pipeCount, true);
    offset += UINT32_SIZE;
    this.view.setUint32(offset, 0, true);
  }

  addPipe(
    pipeId: number,
    diameter: number,
    startNodeId: number,
    endNodeId: number,
  ): void {
    const index = this.pipesIndex.get(pipeId)!;
    const startNodeIndex = this.nodesIndex.get(startNodeId)!;
    const endNodeIndex = this.nodesIndex.get(endNodeId)!;

    let offset = BUFFER_HEADER_SIZE + index * PIPE_BINARY_SIZE;

    this.view.setUint32(offset, pipeId, true);
    offset += UINT32_SIZE;

    this.view.setFloat64(offset, diameter, true);
    offset += FLOAT64_SIZE;
    this.view.setUint32(offset, startNodeIndex, true);
    offset += UINT32_SIZE;
    this.view.setUint32(offset, endNodeIndex, true);
  }

  build(): BinaryData {
    return this.buffer;
  }
}

class NodesBinaryBuilder {
  private buffer: BinaryData;
  private view: DataView;

  constructor(
    nodeCount: number,
    private nodesIndex: Map<number, number>,
    private bufferType: "shared" | "array" = "array",
  ) {
    const totalSize = BUFFER_HEADER_SIZE + nodeCount * NODE_BINARY_SIZE;
    this.buffer =
      this.bufferType === "shared"
        ? new SharedArrayBuffer(totalSize)
        : new ArrayBuffer(totalSize);
    this.view = new DataView(this.buffer);

    let offset = 0;
    this.view.setUint32(offset, nodeCount, true);
    offset += UINT32_SIZE;
    this.view.setUint32(offset, 0, true);
  }

  addNode(nodeId: number, coordinates: Position, nodeType: NodeType): void {
    const index = this.nodesIndex.get(nodeId)!;
    let offset = BUFFER_HEADER_SIZE + index * NODE_BINARY_SIZE;

    this.view.setFloat64(offset, coordinates[0], true);
    offset += FLOAT64_SIZE;
    this.view.setFloat64(offset, coordinates[1], true);
    offset += FLOAT64_SIZE;
    this.view.setUint32(offset, NODE_TYPE_TO_ENUM[nodeType], true);
    offset += UINT32_SIZE;

    this.view.setUint32(offset, nodeId, true);
  }

  build(): BinaryData {
    return this.buffer;
  }
}

class CustomerPointsBinaryBuilder {
  private buffer: BinaryData;
  private view: DataView;

  constructor(
    customerPointCount: number,
    private bufferType: "shared" | "array" = "array",
  ) {
    const totalSize =
      BUFFER_HEADER_SIZE + customerPointCount * CUSTOMER_POINT_BINARY_SIZE;
    this.buffer =
      this.bufferType === "shared"
        ? new SharedArrayBuffer(totalSize)
        : new ArrayBuffer(totalSize);
    this.view = new DataView(this.buffer);

    let offset = 0;
    this.view.setUint32(offset, customerPointCount, true);
    offset += UINT32_SIZE;
    this.view.setUint32(offset, 0, true);
  }

  addCustomerPoint(
    customerPointId: number,
    coordinates: Position,
    index: number,
  ): void {
    let offset = BUFFER_HEADER_SIZE + index * CUSTOMER_POINT_BINARY_SIZE;

    this.view.setUint32(offset, customerPointId, true);
    offset += UINT32_SIZE;

    this.view.setFloat64(offset, coordinates[0], true);
    offset += FLOAT64_SIZE;
    this.view.setFloat64(offset, coordinates[1], true);
  }

  updateCount(count: number): void {
    this.view.setUint32(0, count, true);
  }

  build(): BinaryData {
    return this.buffer;
  }
}

class ZoneGeometryBinaryBuilder {
  private buffer: BinaryData;
  private view: DataView;
  private offset: number;

  constructor(
    geometry: MultiPolygon,
    bufferType: "shared" | "array" = "array",
  ) {
    let totalSize = BUFFER_HEADER_SIZE;
    for (const polygon of geometry.coordinates) {
      totalSize += UINT32_SIZE;
      for (const ring of polygon) {
        totalSize += UINT32_SIZE;
        totalSize += ring.length * 2 * FLOAT64_SIZE;
      }
    }

    this.buffer =
      bufferType === "shared"
        ? new SharedArrayBuffer(totalSize)
        : new ArrayBuffer(totalSize);
    this.view = new DataView(this.buffer);

    this.offset = 0;
    this.view.setUint32(this.offset, geometry.coordinates.length, true);
    this.offset += UINT32_SIZE;
    this.view.setUint32(this.offset, 0, true);
    this.offset += UINT32_SIZE;
  }

  addPolygon(rings: Position[][]): void {
    this.view.setUint32(this.offset, rings.length, true);
    this.offset += UINT32_SIZE;

    for (const ring of rings) {
      this.view.setUint32(this.offset, ring.length, true);
      this.offset += UINT32_SIZE;

      for (const position of ring) {
        this.view.setFloat64(this.offset, position[0], true);
        this.offset += FLOAT64_SIZE;
        this.view.setFloat64(this.offset, position[1], true);
        this.offset += FLOAT64_SIZE;
      }
    }
  }

  build(): BinaryData {
    return this.buffer;
  }
}

const hasResolvableEndpoints = (pipe: Pipe, assets: AssetsMap): boolean =>
  pipe.connections.every((nodeId) => assets.has(nodeId));

const hasJunctionEndpoint = (pipe: Pipe, assets: AssetsMap): boolean =>
  pipe.connections.some((nodeId) => assets.get(nodeId)?.type === "junction");

export const hasValidDiameter = (
  pipe: Pipe,
): pipe is Pipe & { diameter: number } =>
  pipe.diameter !== null && pipe.diameter !== 0;

const isAllocatablePipe = (
  pipe: Pipe,
  assets: AssetsMap,
  selectedPipes?: Set<AssetId>,
): boolean =>
  (!selectedPipes || selectedPipes.has(pipe.id)) &&
  pipe.isActive &&
  hasValidDiameter(pipe) &&
  hasResolvableEndpoints(pipe, assets) &&
  hasJunctionEndpoint(pipe, assets);

const generateAssetIndexes = (
  assets: AssetsMap,
  selectedPipes?: Set<AssetId>,
): {
  pipesIndex: Map<number, number>;
  pipesCount: number;
  pipeSegmentsCount: number;
  nodesIndex: Map<number, number>;
  nodesCount: number;
} => {
  const pipesIndex = new Map<number, number>();
  const connectedNodeIds = new Set<AssetId>();
  let pipeIndex = 0;
  let pipeSegmentsCount = 0;

  for (const asset of assets.values()) {
    if (!asset.isLink || asset.type !== "pipe") continue;

    const pipe = asset as Pipe;
    if (!isAllocatablePipe(pipe, assets, selectedPipes)) continue;

    pipesIndex.set(pipe.id, pipeIndex);
    pipeSegmentsCount += pipe.coordinates.length - 1;
    pipeIndex++;

    for (const nodeId of pipe.connections) {
      connectedNodeIds.add(nodeId);
    }
  }

  const nodesIndex = new Map<number, number>();
  let nodeIndex = 0;
  for (const nodeId of Array.from(connectedNodeIds).sort((a, b) => a - b)) {
    nodesIndex.set(nodeId, nodeIndex);
    nodeIndex++;
  }

  return {
    pipesIndex,
    pipesCount: pipeIndex,
    pipeSegmentsCount,
    nodesIndex,
    nodesCount: nodeIndex,
  };
};
