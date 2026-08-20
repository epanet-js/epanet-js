import {
  FixedSizeBufferBuilder,
  FixedSizeBufferView,
  type BinaryData,
} from "@epanet-js/buffers";
import type { CustomerPointConnection } from "@epanet-js/hydraulic-model";

export type AllocationResult = {
  customerPointId: number;
  connection: CustomerPointConnection | null;
  ruleIndex: number;
  inZone: boolean;
};

// Records are 40 bytes and the header is padded to 8 so every snap point stays
// aligned for float64 access.
const RECORD_SIZE = 40;
const HEADER_PADDING = 4;

const SNAP_LONGITUDE = 0;
const SNAP_LATITUDE = 8;
const CUSTOMER_POINT_ID = 16;
const PIPE_ID = 20;
const JUNCTION_ID = 24;
const RULE_INDEX = 28;
const FLAGS = 32;

const IN_ZONE = 1;
const CONNECTED = 2;

const encodeResult = (
  result: AllocationResult,
  offset: number,
  view: DataView,
): void => {
  const { connection } = result;

  view.setFloat64(
    offset + SNAP_LONGITUDE,
    connection ? connection.snapPoint[0] : 0,
    true,
  );
  view.setFloat64(
    offset + SNAP_LATITUDE,
    connection ? connection.snapPoint[1] : 0,
    true,
  );
  view.setUint32(offset + CUSTOMER_POINT_ID, result.customerPointId, true);
  view.setUint32(offset + PIPE_ID, connection ? connection.pipeId : 0, true);
  view.setUint32(
    offset + JUNCTION_ID,
    connection ? connection.junctionId : 0,
    true,
  );
  view.setInt32(offset + RULE_INDEX, result.ruleIndex, true);
  view.setUint32(
    offset + FLAGS,
    (result.inZone ? IN_ZONE : 0) | (connection ? CONNECTED : 0),
    true,
  );
};

const decodeResult = (offset: number, view: DataView): AllocationResult => {
  const flags = view.getUint32(offset + FLAGS, true);

  return {
    customerPointId: view.getUint32(offset + CUSTOMER_POINT_ID, true),
    ruleIndex: view.getInt32(offset + RULE_INDEX, true),
    inZone: (flags & IN_ZONE) !== 0,
    connection:
      (flags & CONNECTED) !== 0
        ? {
            pipeId: view.getUint32(offset + PIPE_ID, true),
            junctionId: view.getUint32(offset + JUNCTION_ID, true),
            snapPoint: [
              view.getFloat64(offset + SNAP_LONGITUDE, true),
              view.getFloat64(offset + SNAP_LATITUDE, true),
            ],
          }
        : null,
  };
};

export class AllocationResultsBuilder {
  private builder: FixedSizeBufferBuilder<AllocationResult>;

  constructor(count: number) {
    this.builder = new FixedSizeBufferBuilder<AllocationResult>(
      RECORD_SIZE,
      count,
      "array",
      encodeResult,
      HEADER_PADDING,
      () => {},
    );
  }

  set(index: number, result: AllocationResult): void {
    this.builder.addAtIndex(index, result);
  }

  build(): ArrayBuffer {
    return this.builder.finalize() as ArrayBuffer;
  }
}

export class AllocationResultsView {
  private view: FixedSizeBufferView<AllocationResult>;

  constructor(buffer: BinaryData) {
    this.view = new FixedSizeBufferView<AllocationResult>(
      buffer,
      RECORD_SIZE,
      decodeResult,
      HEADER_PADDING,
    );
  }

  get count(): number {
    return this.view.count;
  }

  at(index: number): AllocationResult {
    return this.view.getById(index);
  }

  *iter(): Generator<AllocationResult> {
    yield* this.view.iter();
  }
}
