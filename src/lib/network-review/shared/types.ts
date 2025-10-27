export type BinaryData = ArrayBuffer | SharedArrayBuffer;

export type BufferType = "shared" | "array";

export interface BufferWithIndex {
  data: BinaryData;
  index: BinaryData;
}

export interface NetworkReviewBuffers {
  links: {
    connections: BinaryData;
    bounds: BinaryData;
    types: BinaryData;
  };
  nodes: {
    positions: BinaryData;
    connections: BufferWithIndex;
    types: BinaryData;
    geoIndex: BinaryData;
  };
  pipeSegments: {
    ids: BinaryData;
    coordinates: BinaryData;
    geoIndex: BinaryData;
  };
  nodeIdsLookup: string[];
  linkIdsLookup: string[];
}
