/**
 * Converts GeoTIFF GeoKeys to CRS information and proj4 definition strings.
 *
 * Handles the full GeoTIFF 1.1 spec (OGC 19-008r4):
 * - All 27 projection methods (ProjCoordTransGeoKey)
 * - Angular unit conversion (degrees, grads, radians)
 * - Custom linear units (+to_meter fallback)
 * - Ellipsoid by EPSG code or semi-major/semi-minor axes
 * - Prime meridian by code or longitude
 */

import {
  ANGULAR_UNIT_TO_DEG,
  CT_TRANSV_MERCATOR_SOUTH_ORIENTED,
  ELLIPSOID_MAP,
  LINEAR_UNIT_MAP,
  LINEAR_UNIT_TO_METER,
  PM_GREENWICH,
  PRIME_MERIDIAN_MAP,
  PROJ_COORD_TRANS_MAP,
} from "./spec";

function linearUnitToMeterFactor(geoKeys: Record<string, number>): number {
  const unitCode = geoKeys.ProjLinearUnitsGeoKey;
  if (unitCode == null) return 1; // no unit specified → assume meters
  return (
    LINEAR_UNIT_TO_METER[unitCode] ?? geoKeys.ProjLinearUnitSizeGeoKey ?? 1
  );
}

export function extractCustomProj4(
  geoKeys: Record<string, number>,
): string | null {
  const coordTrans = geoKeys.ProjCoordTransGeoKey;
  if (!coordTrans) return null;

  const projName = PROJ_COORD_TRANS_MAP[coordTrans];
  if (!projName) return null;

  const parts: string[] = [`+proj=${projName}`];

  // South-oriented Transverse Mercator
  if (coordTrans === CT_TRANSV_MERCATOR_SOUTH_ORIENTED) parts.push("+axis=wsu");

  // Angular unit conversion: if parameters are in grads/radians, convert to degrees
  const angularUnits = geoKeys.GeogAngularUnitsGeoKey;
  const angularFactor =
    angularUnits != null ? (ANGULAR_UNIT_TO_DEG[angularUnits] ?? 1) : 1;
  const toDeg = (v: number) => (angularFactor === 1 ? v : v * angularFactor);

  // Latitude/longitude of origin (natural origin, center, or false origin)
  const lat0 =
    geoKeys.ProjNatOriginLatGeoKey ??
    geoKeys.ProjCenterLatGeoKey ??
    geoKeys.ProjFalseOriginLatGeoKey;
  if (lat0 != null) parts.push(`+lat_0=${toDeg(lat0)}`);

  const lon0 =
    geoKeys.ProjNatOriginLongGeoKey ??
    geoKeys.ProjCenterLongGeoKey ??
    geoKeys.ProjFalseOriginLongGeoKey ??
    geoKeys.ProjStraightVertPoleLongGeoKey; // Polar Stereographic
  if (lon0 != null) parts.push(`+lon_0=${toDeg(lon0)}`);

  // Standard parallels (for LCC, Albers, etc.)
  if (geoKeys.ProjStdParallel1GeoKey != null) {
    parts.push(`+lat_1=${toDeg(geoKeys.ProjStdParallel1GeoKey)}`);
  }
  if (geoKeys.ProjStdParallel2GeoKey != null) {
    parts.push(`+lat_2=${toDeg(geoKeys.ProjStdParallel2GeoKey)}`);
  }

  // Scale factor
  const k =
    geoKeys.ProjScaleAtNatOriginGeoKey ?? geoKeys.ProjScaleAtCenterGeoKey;
  if (k != null) parts.push(`+k=${k}`);

  // False easting/northing (direct, false origin, or center variants)
  // proj4 expects +x_0/+y_0 in meters, but GeoTIFF stores them in the
  // projection's linear unit — convert when necessary.
  const toMeters = linearUnitToMeterFactor(geoKeys);
  const x0 =
    geoKeys.ProjFalseEastingGeoKey ??
    geoKeys.ProjFalseOriginEastingGeoKey ??
    geoKeys.ProjCenterEastingGeoKey;
  if (x0 != null) parts.push(`+x_0=${x0 * toMeters}`);

  const y0 =
    geoKeys.ProjFalseNorthingGeoKey ??
    geoKeys.ProjFalseOriginNorthingGeoKey ??
    geoKeys.ProjCenterNorthingGeoKey;
  if (y0 != null) parts.push(`+y_0=${y0 * toMeters}`);

  // Azimuth (for Oblique Mercator — may use its own angular unit)
  if (geoKeys.ProjAzimuthAngleGeoKey != null) {
    const azUnits = geoKeys.GeogAzimuthUnitsGeoKey;
    const azFactor =
      azUnits != null
        ? (ANGULAR_UNIT_TO_DEG[azUnits] ?? angularFactor)
        : angularFactor;
    const azDeg =
      azFactor === 1
        ? geoKeys.ProjAzimuthAngleGeoKey
        : geoKeys.ProjAzimuthAngleGeoKey * azFactor;
    parts.push(`+alpha=${azDeg}`);
  }
  if (geoKeys.ProjRectifiedGridAngleGeoKey != null) {
    parts.push(`+gamma=${toDeg(geoKeys.ProjRectifiedGridAngleGeoKey)}`);
  }

  // Ellipsoid
  const ellipsoidCode = geoKeys.GeogEllipsoidGeoKey;
  if (ellipsoidCode && ELLIPSOID_MAP[ellipsoidCode]) {
    parts.push(`+ellps=${ELLIPSOID_MAP[ellipsoidCode]}`);
  } else if (geoKeys.GeogSemiMajorAxisGeoKey != null) {
    parts.push(`+a=${geoKeys.GeogSemiMajorAxisGeoKey}`);
    if (geoKeys.GeogInvFlatteningGeoKey != null) {
      parts.push(`+rf=${geoKeys.GeogInvFlatteningGeoKey}`);
    } else if (geoKeys.EllipsoidSemiMinorAxisGeoKey != null) {
      parts.push(`+b=${geoKeys.EllipsoidSemiMinorAxisGeoKey}`);
    }
  }

  // Prime meridian
  const pmCode = geoKeys.GeogPrimeMeridianGeoKey;
  if (pmCode && pmCode !== PM_GREENWICH) {
    const pmName = PRIME_MERIDIAN_MAP[pmCode];
    if (pmName) {
      parts.push(`+pm=${pmName}`);
    } else if (geoKeys.GeogPrimeMeridianLongGeoKey != null) {
      parts.push(`+pm=${toDeg(geoKeys.GeogPrimeMeridianLongGeoKey)}`);
    }
  }

  // Linear units
  const knownUnit =
    geoKeys.ProjLinearUnitsGeoKey != null
      ? LINEAR_UNIT_MAP[geoKeys.ProjLinearUnitsGeoKey]
      : null;
  if (knownUnit) {
    parts.push(`+units=${knownUnit}`);
  } else if (geoKeys.ProjLinearUnitsGeoKey != null) {
    if (toMeters !== 1) {
      parts.push(`+to_meter=${toMeters}`);
    }
  }

  parts.push("+no_defs");
  return parts.join(" ");
}
