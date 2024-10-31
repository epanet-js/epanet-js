import type { Feature } from "src/types";
import type { BufferOptions } from "src/lib/buffer";
import { lib } from "src/lib/worker";

export async function buffer(feature: Feature, options: BufferOptions) {
  return lib.bufferFeature(feature, options);
}

export default buffer;
