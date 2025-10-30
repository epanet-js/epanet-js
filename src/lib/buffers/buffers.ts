const UINT32_SIZE = 4;
const UINT8_SIZE = 1;
const FLOAT64_SIZE = 8;

export type BinaryData = ArrayBuffer | SharedArrayBuffer;

export type BufferType = "shared" | "array";

export interface BufferWithIndex {
  data: BinaryData;
  index: BinaryData;
}

export const DataSize = {
  type: UINT8_SIZE,
  number: UINT32_SIZE,
  decimal: FLOAT64_SIZE,
} as const;

export class FixedSizeBufferBuilder<T> {
  private view: DataView;
  private currentIndex: number = 0;

  constructor(
    private readonly recordSize: number,
    count: number,
    bufferType: BufferType,
    private readonly encoder: (data: T, offset: number, view: DataView) => void,
  ) {
    const totalSize = DataSize.number + count * recordSize;
    this.view = new DataView(createBuffer(totalSize, bufferType));
    encodeCount(this.view, count);
  }

  add(data: T): void {
    const offset = DataSize.number + this.currentIndex * this.recordSize;
    this.encoder(data, offset, this.view);
    this.currentIndex++;
  }

  addAtIndex(index: number, data: T): void {
    const offset = DataSize.number + index * this.recordSize;
    this.encoder(data, offset, this.view);
  }

  finalize(): BinaryData {
    return this.view.buffer;
  }
}

export class FixedSizeBufferView<T> {
  private view: DataView;
  readonly count: number;

  constructor(
    buffer: BinaryData,
    private readonly recordSize: number,
    private readonly decoder: (offset: number, view: DataView) => T,
  ) {
    this.view = new DataView(buffer);
    this.count = decodeCount(this.view);
  }

  getById(id: number): T {
    if (id < 0 || id >= this.count) {
      throw new RangeError(
        `Index ${id} is out of bounds (valid range: 0-${this.count - 1})`,
      );
    }
    const offset = DataSize.number + id * this.recordSize;
    return this.decoder(offset, this.view);
  }

  *iter(): Generator<T> {
    for (let i = 0; i < this.count; i++) {
      yield this.getById(i);
    }
  }

  *enumerate(): Generator<[number, T]> {
    let i = 0;
    for (const item of this.iter()) {
      yield [i++, item];
    }
  }
}

export class VariableSizeBufferBuilder<T> {
  private dataView: DataView;
  private indexView: DataView;
  private readonly encoder: (data: T, offset: number, view: DataView) => void;
  private readonly sizeCalculator: (data: T) => number;
  private currentIndex: number = 0;
  private currentOffset: number = 0;

  constructor(
    count: number,
    totalDataSize: number,
    bufferType: BufferType,
    encoder: (data: T, offset: number, view: DataView) => void,
    sizeCalculator: (data: T) => number,
  ) {
    this.dataView = new DataView(
      createBuffer(totalDataSize + DataSize.number, bufferType),
    );
    encodeCount(this.dataView, count);
    this.currentOffset = DataSize.number;

    const indexSize = count * DataSize.number;
    this.indexView = new DataView(createBuffer(indexSize, bufferType));

    this.encoder = encoder;
    this.sizeCalculator = sizeCalculator;
  }

  add(data: T): void {
    this.encoder(data, this.currentOffset, this.dataView);

    const size = this.sizeCalculator(data);
    encodeNumber(
      this.currentOffset,
      this.currentIndex * DataSize.number,
      this.indexView,
    );
    this.currentOffset += size;
    this.currentIndex++;
  }

  finalize(): BufferWithIndex {
    return {
      data: this.dataView.buffer,
      index: this.indexView.buffer,
    };
  }
}

export class VariableSizeBufferView<T> {
  private dataView: DataView;
  private offsetView: DataView;
  readonly count: number;

  constructor(
    buffer: BufferWithIndex,
    private readonly decoder: (offset: number, view: DataView) => T,
  ) {
    this.dataView = new DataView(buffer.data);
    this.offsetView = new DataView(buffer.index);
    this.count = decodeCount(this.dataView);
  }

  getById(id: number): T {
    if (id < 0 || id >= this.count) {
      throw new RangeError(
        `Index ${id} is out of bounds (valid range: 0-${this.count - 1})`,
      );
    }
    const offset = decodeNumber(id * DataSize.number, this.offsetView);
    return this.decoder(offset, this.dataView);
  }

  *iter(): Generator<T> {
    for (let i = 0; i < this.count; i++) {
      yield this.getById(i);
    }
  }

  *enumerate(): Generator<[number, T]> {
    for (let i = 0; i < this.count; i++) {
      yield [i, this.getById(i)];
    }
  }
}

export function createBuffer(size: number, bufferType: BufferType): BinaryData {
  return bufferType === "shared"
    ? new SharedArrayBuffer(size)
    : new ArrayBuffer(size);
}

export function decodeNumber(offset: number, view: DataView): number {
  return view.getUint32(offset, true);
}

export function encodeNumber(
  value: number,
  offset: number,
  view: DataView,
): void {
  view.setUint32(offset, value, true);
}

export function decodeDecimal(offset: number, view: DataView): number {
  return view.getFloat64(offset, true);
}

export function encodeDecimal(
  value: number,
  offset: number,
  view: DataView,
): void {
  view.setFloat64(offset, value, true);
}

export function encodeType(type: number, offset: number, view: DataView): void {
  view.setUint8(offset, type);
}

export function decodeType(offset: number, view: DataView): number {
  return view.getUint8(offset);
}

export const encodeCount = (view: DataView, count: number) =>
  encodeNumber(count, 0, view);

export const decodeCount = (view: DataView): number => decodeNumber(0, view);
