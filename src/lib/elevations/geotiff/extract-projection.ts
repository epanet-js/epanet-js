// eslint-disable-next-line no-restricted-imports
import proj4 from "proj4";
import { extractCustomProj4 } from "./extract-custom-proj4";
import {
  GT_MODEL_TYPE_GEOCENTRIC,
  GT_MODEL_TYPE_GEOGRAPHIC,
  GT_MODEL_TYPE_PROJECTED,
  PROJ4_UNITS_MAP,
  USER_DEFINED_CODE,
  WGS84_GEOGRAPHIC_CODES,
} from "./spec";
import { CrsUnit } from "./types";

type ProjectionErrorCode =
  | "invalidCustomProjection"
  | "cartesianProjection"
  | "unknownProjectionCode";
export class ProjectionError extends Error {
  public readonly code: ProjectionErrorCode;

  constructor(code: ProjectionErrorCode) {
    super(`Unsupported CRS model type: ${code}`);
    this.name = "UnsupportedCrsError";
    this.code = code;
  }
}

export function extractProjectionUnits(proj4Def?: string): CrsUnit | undefined {
  if (!proj4Def) return undefined;
  const match = proj4Def.match(/\+units=(\S+)/);
  if (!match) return undefined;
  return PROJ4_UNITS_MAP[match[1]];
}

export async function extractProjection(
  geoKeys: Record<string, number> | null,
  fetchProj4Def: (epsgCode: number) => Promise<string | null>,
) {
  let proj4Def: string | undefined;

  const { epsgCode, userDefinedProj4 } = resolveProjection(geoKeys);

  if (epsgCode) {
    const def = await fetchProj4Def(epsgCode);
    if (def) {
      proj4Def = def;
    } else {
      throw new ProjectionError("unknownProjectionCode");
    }
  }
  if (userDefinedProj4) {
    proj4Def = userDefinedProj4;
  }

  return proj4Def;
}

function resolveProjection(keys: Record<string, number> | null): {
  epsgCode: number | null;
  userDefinedProj4: string | null;
} {
  if (keys === null) {
    return { epsgCode: null, userDefinedProj4: null };
  }

  const modelType = keys.GTModelTypeGeoKey;

  const epsgCode =
    modelType === GT_MODEL_TYPE_PROJECTED
      ? keys.ProjectedCSTypeGeoKey
      : modelType === GT_MODEL_TYPE_GEOGRAPHIC
        ? keys.GeographicTypeGeoKey
        : null;

  if (epsgCode && WGS84_GEOGRAPHIC_CODES.has(epsgCode)) {
    // WGS84 — no reprojection needed
    return { epsgCode: null, userDefinedProj4: null };
  }

  if (epsgCode === USER_DEFINED_CODE) {
    const customProjection = validateProj4(extractCustomProj4(keys));
    if (!customProjection) throw new ProjectionError("invalidCustomProjection");
    return { epsgCode: null, userDefinedProj4: customProjection };
  }

  if (epsgCode) {
    return { epsgCode, userDefinedProj4: null };
  }

  if (modelType === GT_MODEL_TYPE_GEOCENTRIC) {
    throw new ProjectionError("cartesianProjection");
  }

  // WGS84, missing GTModelTypeGeoKey, or unrecognized model type.
  // Default to no reprojection — assumes WGS84-compatible coordinates.
  return { epsgCode: null, userDefinedProj4: null };
}

function validateProj4(def: string | null): string | null {
  if (!def) return null;
  try {
    proj4(def);
    return def;
  } catch {
    return null;
  }
}
