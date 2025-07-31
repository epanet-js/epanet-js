import { LineString, Feature, Position } from "@turf/helpers";
import lineSegment from "@turf/line-segment";
import bbox from "@turf/bbox";
import Flatbush from "flatbush";
import { Pipe } from "../../asset-types/pipe";
import { HydraulicModel } from "../../hydraulic-model";
import { getAssetsByType } from "src/__helpers__/asset-queries";
import { AllocationRule } from "./allocate-customer-points";

export interface LinkSegmentProperties {
  linkId: string;
}

export type LinkSegment = Feature<LineString, LinkSegmentProperties>;

export interface WorkerSpatialData {
  flatbushIndexData: SharedArrayBuffer;
  segmentsData: SharedArrayBuffer;
  pipesData: SharedArrayBuffer;
}

const BUFFER_HEADER_SIZE = 8;
const SEGMENT_BINARY_SIZE = 36;
const UINT32_SIZE = 4;
const FLOAT64_SIZE = 8;
const MIN_BUFFER_SIZE = 8;
const FLATBUSH_NODE_SIZE = 16;
const COORDINATES_PER_SEGMENT = 2;

const getSegmentOffset = (index: number): number => {
  return BUFFER_HEADER_SIZE + index * SEGMENT_BINARY_SIZE;
};

const getPipeIndexOffset = (index: number): number => {
  return getSegmentOffset(index);
};

const getCoordinatesOffset = (index: number): number => {
  return getSegmentOffset(index) + UINT32_SIZE;
};

export const getSegmentCoordinates = (
  segmentsData: SharedArrayBuffer,
  index: number,
): Position[] => {
  const view = new DataView(segmentsData);
  let offset = getCoordinatesOffset(index);

  const coordinates: Position[] = [];
  for (let i = 0; i < COORDINATES_PER_SEGMENT; i++) {
    const lng = view.getFloat64(offset, true);
    offset += FLOAT64_SIZE;
    const lat = view.getFloat64(offset, true);
    offset += FLOAT64_SIZE;
    coordinates.push([lng, lat]);
  }

  return coordinates;
};

export const getSegmentPipeIndex = (
  segmentsData: SharedArrayBuffer,
  index: number,
): number => {
  const view = new DataView(segmentsData);
  const offset = getPipeIndexOffset(index);
  return view.getUint32(offset, true);
};

export const getPipeDiameter = (
  pipesData: SharedArrayBuffer,
  index: number,
): number => {
  const view = new DataView(pipesData);
  const offset = BUFFER_HEADER_SIZE + index * FLOAT64_SIZE;
  return view.getFloat64(offset, true);
};

export const prepareWorkerData = (
  hydraulicModel: HydraulicModel,
  allocationRules: AllocationRule[],
): WorkerSpatialData => {
  const maxAllowedDiameter = Math.max(
    ...allocationRules.map((rule) => rule.maxDiameter),
  );
  const pipes = getAssetsByType<Pipe>(
    hydraulicModel.assets,
    "pipe",
    (pipe) => pipe.diameter <= maxAllowedDiameter,
  );

  if (pipes.length === 0) {
    const emptyIndexBuffer = new SharedArrayBuffer(MIN_BUFFER_SIZE);
    const emptySegmentsBuffer = new SharedArrayBuffer(MIN_BUFFER_SIZE);
    const emptyPipesBuffer = new SharedArrayBuffer(MIN_BUFFER_SIZE);

    return {
      flatbushIndexData: emptyIndexBuffer,
      segmentsData: emptySegmentsBuffer,
      pipesData: emptyPipesBuffer,
    };
  }

  const { pipesIndex, pipesCount, pipeSegmentsCount } =
    generateAssetIndexes(pipes);

  const segmentsBuilder = new SegmentsBinaryBuilder(
    pipeSegmentsCount,
    pipesIndex,
  );
  const pipesBuilder = new PipesBinaryBuilder(pipesCount, pipesIndex);
  const spatialIndex = new Flatbush(
    pipeSegmentsCount,
    FLATBUSH_NODE_SIZE,
    Float64Array,
    SharedArrayBuffer,
  );

  for (const pipe of pipes) {
    pipesBuilder.addPipe(pipe.id, pipe.diameter);

    if (pipe.feature.geometry.type === "LineString") {
      const pipeFeature = {
        type: "Feature" as const,
        geometry: pipe.feature.geometry as LineString,
        properties: {},
      };
      const segments = lineSegment(pipeFeature);
      for (const segment of segments.features) {
        const coordinates = segment.geometry.coordinates;
        segmentsBuilder.addSegment(coordinates, pipe.id);

        const [minX, minY, maxX, maxY] = bbox(segment);
        spatialIndex.add(minX, minY, maxX, maxY);
      }
    }
  }

  spatialIndex.finish();

  return {
    flatbushIndexData: spatialIndex.data as SharedArrayBuffer,
    segmentsData: segmentsBuilder.build(),
    pipesData: pipesBuilder.build(),
  };
};

class SegmentsBinaryBuilder {
  private buffer: SharedArrayBuffer;
  private view: DataView;
  private segmentIndex: number = 0;

  constructor(
    segmentCount: number,
    private pipesIndex: Map<string, number>,
  ) {
    const totalSize = BUFFER_HEADER_SIZE + segmentCount * SEGMENT_BINARY_SIZE;
    this.buffer = new SharedArrayBuffer(totalSize);
    this.view = new DataView(this.buffer);

    let offset = 0;
    this.view.setUint32(offset, segmentCount, true);
    offset += UINT32_SIZE;
    this.view.setUint32(offset, 0, true);
  }

  addSegment(coordinates: Position[], pipeId: string): void {
    const pipeIndex = this.pipesIndex.get(pipeId)!;
    let offset = BUFFER_HEADER_SIZE + this.segmentIndex * SEGMENT_BINARY_SIZE;

    this.view.setUint32(offset, pipeIndex, true);
    offset += UINT32_SIZE;

    for (const coord of coordinates) {
      this.view.setFloat64(offset, coord[0], true);
      offset += FLOAT64_SIZE;
      this.view.setFloat64(offset, coord[1], true);
      offset += FLOAT64_SIZE;
    }

    this.segmentIndex++;
  }

  build(): SharedArrayBuffer {
    return this.buffer;
  }
}

class PipesBinaryBuilder {
  private buffer: SharedArrayBuffer;
  private view: DataView;

  constructor(
    pipeCount: number,
    private pipesIndex: Map<string, number>,
  ) {
    const totalSize = BUFFER_HEADER_SIZE + pipeCount * FLOAT64_SIZE;
    this.buffer = new SharedArrayBuffer(totalSize);
    this.view = new DataView(this.buffer);

    let offset = 0;
    this.view.setUint32(offset, pipeCount, true);
    offset += UINT32_SIZE;
    this.view.setUint32(offset, 0, true);
  }

  addPipe(pipeId: string, diameter: number): void {
    const index = this.pipesIndex.get(pipeId)!;
    const offset = BUFFER_HEADER_SIZE + index * FLOAT64_SIZE;
    this.view.setFloat64(offset, diameter, true);
  }

  build(): SharedArrayBuffer {
    return this.buffer;
  }
}

const generateAssetIndexes = (
  pipes: Pipe[],
): {
  pipesIndex: Map<string, number>;
  pipesCount: number;
  pipeSegmentsCount: number;
} => {
  const pipesIndex = new Map<string, number>();
  let pipeSegmentsCount = 0;

  for (let pipeIndex = 0; pipeIndex < pipes.length; pipeIndex++) {
    const pipe = pipes[pipeIndex];

    pipesIndex.set(pipe.id, pipeIndex);

    pipeSegmentsCount += pipe.coordinates.length - 1;
  }

  return {
    pipesIndex,
    pipesCount: pipes.length,
    pipeSegmentsCount,
  };
};
