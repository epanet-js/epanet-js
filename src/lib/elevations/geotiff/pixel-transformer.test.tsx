import { describe, it, expect } from "vitest";
import { buildPixelTransformers } from "./pixel-transformer";

describe("buildPixelTransformer", () => {
  const identityMatrix = [0, 1, 0, 0, 0, 1];

  it("applies identity matrix", () => {
    const transformer = buildPixelTransformers({
      crsToPixel: identityMatrix,
      pixelToCrs: identityMatrix,
    });
    expect(transformer.fromPixel(5, 10)).toEqual([5, 10]);
    expect(transformer.toPixel(5, 10)).toEqual([5, 10]);
  });

  it("applies scale and offset", () => {
    const matrix = [100, 0.5, 0, 200, 0, -0.5];
    const transformer = buildPixelTransformers({
      crsToPixel: matrix,
      pixelToCrs: matrix,
    });

    expect(transformer.fromPixel(3, 4)).toEqual([101.5, 198]);
    expect(transformer.toPixel(3, 4)).toEqual([101, 198]);
  });

  it("handles shear terms", () => {
    const matrix = [0, 1, 0.5, 0, 0.5, 1];
    const transformer = buildPixelTransformers({
      crsToPixel: matrix,
      pixelToCrs: matrix,
    });
    expect(transformer.fromPixel(2, 3)).toEqual([3.5, 4]);
    expect(transformer.toPixel(2, 3)).toEqual([3, 4]);
  });
});
