import { decodeCount } from "./buffer-utils";
import { BinaryData } from "./types";

export abstract class BaseBufferView<T> {
  protected view: DataView;
  readonly count: number;

  constructor(public readonly buffer: BinaryData) {
    this.view = new DataView(buffer);
    this.count = decodeCount(this.view);
  }

  abstract iter(): Generator<T>;

  protected *enumerate<U>(iterable: Iterable<U>): Generator<[number, U]> {
    let i = 0;
    for (const item of iterable) {
      yield [i++, item];
    }
  }
}
