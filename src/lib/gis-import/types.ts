import { FeatureCollection } from "geojson";

export type GisParseErrorCode =
  | "invalid-format"
  | "invalid-projection"
  | "missing-projection"
  | "unsupported-crs"
  | "projection-conversion-failed"
  | "no-features";

export class GisParseError extends Error {
  constructor(
    public readonly fileName: string,
    public readonly code: GisParseErrorCode,
  ) {
    super(code);
  }
}

export type GisParseResult = {
  featureCollection: FeatureCollection;
  name: string;
  properties: string[];
};
