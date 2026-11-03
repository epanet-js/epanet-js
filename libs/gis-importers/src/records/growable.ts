type TypedArray = Float64Array | Uint32Array | Uint8Array;

type TypedArrayType<T extends TypedArray> = { new (length: number): T };

const INITIAL_CAPACITY = 1024;

export class Growable<T extends TypedArray> {
  array: T;
  length = 0;

  constructor(private readonly Type: TypedArrayType<T>) {
    this.array = new Type(INITIAL_CAPACITY);
  }

  push(value: number): void {
    if (this.length === this.array.length) this.grow(this.length + 1);
    this.array[this.length++] = value;
  }

  fill(value: number, length: number): void {
    if (length <= this.length) return;
    if (length > this.array.length) this.grow(length);
    this.array.fill(value, this.length, length);
    this.length = length;
  }

  get(index: number): number {
    return this.array[index];
  }

  view(): T {
    return this.array.subarray(0, this.length) as T;
  }

  private grow(minimum: number): void {
    let capacity = this.array.length * 2;
    while (capacity < minimum) capacity *= 2;
    const grown = new this.Type(capacity);
    grown.set(this.array);
    this.array = grown;
  }
}

export const growableFloat64 = (): Growable<Float64Array> =>
  new Growable<Float64Array>(Float64Array);
export const growableUint32 = (): Growable<Uint32Array> =>
  new Growable<Uint32Array>(Uint32Array);
export const growableUint8 = (): Growable<Uint8Array> =>
  new Growable<Uint8Array>(Uint8Array);
