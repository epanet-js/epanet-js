export const ELEVATION_SOURCE_ERROR_NAME = "ElevationSourceError";

export type ElevationSourceErrorCode =
  | "invalidCustomProjection"
  | "cartesianProjection"
  | "unknownProjectionCode"
  | "invalidResolution"
  | "invalidTransformationMatrix"
  | "unknown";

export type ElevationSourceFailure = {
  fileName: string;
  code: ElevationSourceErrorCode;
};

const KNOWN_CODES: ReadonlySet<string> = new Set<ElevationSourceErrorCode>([
  "invalidCustomProjection",
  "cartesianProjection",
  "unknownProjectionCode",
  "invalidResolution",
  "invalidTransformationMatrix",
  "unknown",
]);

export const asElevationSourceErrorCode = (
  value: unknown,
): ElevationSourceErrorCode =>
  typeof value === "string" && KNOWN_CODES.has(value)
    ? (value as ElevationSourceErrorCode)
    : "unknown";

export const toElevationSourceFailure = (
  error: unknown,
): ElevationSourceFailure | null => {
  if (typeof error !== "object" || error === null) return null;

  const candidate = error as {
    name?: unknown;
    fileName?: unknown;
    code?: unknown;
  };
  if (candidate.name !== ELEVATION_SOURCE_ERROR_NAME) return null;
  if (typeof candidate.fileName !== "string") return null;

  return {
    fileName: candidate.fileName,
    code: asElevationSourceErrorCode(candidate.code),
  };
};
