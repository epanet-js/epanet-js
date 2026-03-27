import { GeoTIFFImage } from "geotiff";
import { RASTER_PIXEL_IS_POINT } from "./spec";
import { PixelTransform } from "./types";

type TransformErrorCode = "invalidResolution" | "invalidTransformationMatrix";

export class TransformError extends Error {
  public readonly code: TransformErrorCode;

  constructor(code: TransformErrorCode) {
    super(`TransformError: ${code}`);
    this.name = "TransformError";
    this.code = code;
  }
}

export function extractPixelTransform(
  image: GeoTIFFImage,
  geoKeys: Record<string, number> | null,
): PixelTransform {
  const pixelIsPoint = geoKeys?.GTRasterTypeGeoKey === RASTER_PIXEL_IS_POINT;

  const resolution = image.getResolution();
  const [rx, ry] = resolution;
  if (!rx || !ry) {
    throw new TransformError("invalidResolution");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mt = (image.fileDirectory as any).ModelTransformation as
    | number[]
    | undefined;

  if (mt) {
    const a = mt[0],
      b = mt[1];
    const e = mt[4],
      f = mt[5];

    // PixelIsPoint: origin refers to center of pixel (0,0), shift by -0.5 pixel
    const d = pixelIsPoint ? mt[3] - 0.5 * a - 0.5 * b : mt[3];
    const h = pixelIsPoint ? mt[7] - 0.5 * e - 0.5 * f : mt[7];

    const det = a * f - b * e;
    if (Math.abs(det) < 1e-15) {
      throw new TransformError("invalidTransformationMatrix");
    }
    return {
      pixelToCrs: [d, a, b, h, e, f],
      crsToPixel: [
        (-f * d + b * h) / det,
        f / det,
        -b / det,
        (e * d - a * h) / det,
        -e / det,
        a / det,
      ],
      pixelIsPoint,
      resolution: [Math.abs(rx), Math.abs(ry)],
    };
  }

  const origin = image.getOrigin();

  // PixelIsPoint: origin refers to center of pixel (0,0), shift by -0.5 pixel
  let [gx, gy] = origin;
  if (pixelIsPoint) {
    gx = gx - 0.5 * rx;
    gy = gy - 0.5 * ry;
  }

  return {
    pixelToCrs: [gx, rx, 0, gy, 0, ry],
    crsToPixel: [-gx / rx, 1 / rx, 0, -gy / ry, 0, 1 / ry],
    pixelIsPoint,
    resolution: [Math.abs(rx), Math.abs(ry)],
  };
}

function transformCoordinates(
  a: number,
  b: number,
  matrix?: number[],
  roundToInt = false,
): [number, number] {
  if (!matrix) throw new Error("Invalid transform matrix");
  const round = (v: number) => (roundToInt ? Math.floor(v) : v);
  return [
    round(matrix[0] + matrix[1] * a + matrix[2] * b),
    round(matrix[3] + matrix[4] * a + matrix[5] * b),
  ];
}

export function buildPixelTransformers(
  matrices: Partial<Pick<PixelTransform, "crsToPixel" | "pixelToCrs">>,
) {
  return {
    toPixel: (crsX: number, crsY: number) => {
      return transformCoordinates(crsX, crsY, matrices.crsToPixel, true);
    },
    toSubPixel: (crsX: number, crsY: number) => {
      return transformCoordinates(crsX, crsY, matrices.crsToPixel, false);
    },
    fromPixel: (x: number, y: number) => {
      return transformCoordinates(x, y, matrices.pixelToCrs, false);
    },
  };
}
