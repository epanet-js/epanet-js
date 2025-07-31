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
}

const HEADER_SIZE = 8;
const SEGMENT_SIZE = 36;
const PIPE_ID_SIZE = 4;
const COORDINATE_SIZE = 8;

const getSegmentOffset = (index: number): number => {
  return HEADER_SIZE + index * SEGMENT_SIZE;
};

const getPipeIndexOffset = (index: number): number => {
  return getSegmentOffset(index);
};

const getCoordinatesOffset = (index: number): number => {
  return getSegmentOffset(index) + PIPE_ID_SIZE;
};

export const getSegmentCoordinates = (
  segmentsData: SharedArrayBuffer,
  index: number,
): Position[] => {
  const view = new DataView(segmentsData);
  let offset = getCoordinatesOffset(index);

  const coordinates: Position[] = [];
  // Always exactly 2 coordinate pairs
  for (let i = 0; i < 2; i++) {
    const lng = view.getFloat64(offset, true);
    offset += COORDINATE_SIZE;
    const lat = view.getFloat64(offset, true);
    offset += COORDINATE_SIZE;
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
    const emptyIndexBuffer = new SharedArrayBuffer(8);
    const emptySegmentsBuffer = new SharedArrayBuffer(8);

    return {
      flatbushIndexData: emptyIndexBuffer,
      segmentsData: emptySegmentsBuffer,
    };
  }

  const { segments, segmentsData } = generateSegmentsBinary(pipes);

  const spatialIndex = new Flatbush(
    segments.length,
    16,
    Float64Array,
    SharedArrayBuffer,
  );

  for (const segment of segments) {
    const [minX, minY, maxX, maxY] = bbox(segment);
    spatialIndex.add(minX, minY, maxX, maxY);
  }

  spatialIndex.finish();

  return {
    flatbushIndexData: spatialIndex.data as SharedArrayBuffer,
    segmentsData,
  };
};

function generateSegmentsBinary(pipes: Pipe[]): {
  segments: LinkSegment[];
  segmentsData: SharedArrayBuffer;
} {
  const allSegments: LinkSegment[] = [];
  const binarySegments: Array<{ pipeId: number; coordinates: Position[] }> = [];

  // First pass: generate segments and collect binary data
  for (const pipe of pipes) {
    if (pipe.feature.geometry.type === "LineString") {
      const pipeFeature = {
        type: "Feature" as const,
        geometry: pipe.feature.geometry as LineString,
        properties: { linkId: pipe.id },
      };
      const segments = lineSegment(pipeFeature);
      for (const segment of segments.features) {
        const linkSegment: LinkSegment = {
          ...segment,
          properties: {
            linkId: pipe.id,
          },
        };
        allSegments.push(linkSegment);

        // Convert string ID to integer and collect data for binary format
        const pipeIdInt = parseInt(pipe.id.substring(1), 10); // "P1" -> 1
        binarySegments.push({
          pipeId: pipeIdInt,
          coordinates: segment.geometry.coordinates,
        });
      }
    }
  }

  // Calculate buffer size: header + segments
  const totalSize = HEADER_SIZE + binarySegments.length * SEGMENT_SIZE;

  // Create and write binary data
  const buffer = new SharedArrayBuffer(totalSize);
  const view = new DataView(buffer);

  let offset = 0;

  // Write header
  view.setUint32(offset, binarySegments.length, true); // segmentCount
  offset += 4;
  view.setUint32(offset, 0, true); // reserved
  offset += 4;

  // Write segments (fixed size: pipeId + coordinates)
  for (const segment of binarySegments) {
    // Write pipeId
    view.setUint32(offset, segment.pipeId, true);
    offset += PIPE_ID_SIZE;

    // Write coordinates
    for (const coord of segment.coordinates) {
      view.setFloat64(offset, coord[0], true); // longitude
      offset += 8;
      view.setFloat64(offset, coord[1], true); // latitude
      offset += 8;
    }
  }

  return {
    segments: allSegments,
    segmentsData: buffer,
  };
}
