import { decodeCount, decodeNumber } from "./buffer-utils";
import { DataSize } from "./constants";
import { BinaryData, BufferWithIndex } from "./types";

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

  private readAddress(id: number): number | undefined {
    if (id < 0 || id >= this.count) return;
    return id;
  }

  *iter(): Generator<T> {
    for (let i = 0; i < this.count; i++) {
      const offset = DataSize.count + i * this.recordSize;
      yield this.decoder(offset, this.view);
    }
  }

  *enumerate(): Generator<[number, T]> {
    let i = 0;
    for (const item of this.iter()) {
      yield [i++, item];
    }
  }

  getById(id: number): T | undefined {
    const index = this.readAddress(id);
    if (index === undefined) return undefined;
    const offset = DataSize.count + index * this.recordSize;
    return this.decoder(offset, this.view);
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

  private readOffset(id: number): number | undefined {
    if (id < 0 || id >= this.count) return;
    return decodeNumber(id * DataSize.count, this.offsetView);
  }

  *iter(): Generator<T> {
    for (let i = 0; i < this.count; i++) {
      const offset = this.readOffset(i);
      if (offset === undefined) continue;
      yield this.decoder(offset, this.dataView);
    }
  }

  *enumerate(): Generator<[number, T]> {
    let i = 0;
    for (const item of this.iter()) {
      yield [i++, item];
    }
  }

  getById(id: number): T | undefined {
    const offset = this.readOffset(id);
    if (offset === undefined) return undefined;
    return this.decoder(offset, this.dataView);
  }
}
