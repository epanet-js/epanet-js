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

import { LinearUnit } from "./types";

const CT_TRANSV_MERCATOR_SOUTH_ORIENTED = 27;
const PM_GREENWICH = 8901;

// GeoTIFF ProjLinearUnitsGeoKey / VerticalUnitsGeoKey → linear unit
const LINEAR_UNIT_MAP: Record<number, LinearUnit> = {
  9001: "m",
  9002: "ft",
  9003: "us-ft",
};

// GeoTIFF ProjCoordTransGeoKey → proj4 projection name
// Values 1-27 from GeoTIFF spec Annex C, Table C.1
const PROJ_COORD_TRANS_MAP: Record<number, string> = {
  1: "tmerc", // CT_TransverseMercator
  2: "tmerc", // CT_TransvMercator_Modified_Alaska
  3: "omerc", // CT_ObliqueMercator (Hotine)
  4: "labrd", // CT_ObliqueMercator_Laborde
  5: "somerc", // CT_ObliqueMercator_Rosenmund (Swiss)
  6: "omerc", // CT_ObliqueMercator_Spherical
  7: "merc", // CT_Mercator
  8: "lcc", // CT_LambertConfConic_2SP
  9: "lcc", // CT_LambertConfConic_1SP (Helmert)
  10: "laea", // CT_LambertAzimEqualArea
  11: "aea", // CT_AlbersEqualArea
  12: "aeqd", // CT_AzimuthalEquidistant
  13: "eqdc", // CT_EquidistantConic
  14: "stere", // CT_Stereographic
  15: "stere", // CT_PolarStereographic
  16: "sterea", // CT_ObliqueStereographic
  17: "eqc", // CT_Equirectangular
  18: "cass", // CT_CassiniSoldner
  19: "gnom", // CT_Gnomonic
  20: "mill", // CT_MillerCylindrical
  21: "ortho", // CT_Orthographic
  22: "poly", // CT_Polyconic
  23: "robin", // CT_Robinson
  24: "sinu", // CT_Sinusoidal
  25: "vandg", // CT_VanDerGrinten
  26: "nzmg", // CT_NewZealandMapGrid
  27: "tmerc", // CT_TransvMercator_SouthOriented (uses +axis=wsu)
};

// EPSG ellipsoid codes → proj4 +ellps values
const ELLIPSOID_MAP: Record<number, string> = {
  7001: "airy",
  7002: "mod_airy", // Airy Modified
  7003: "aust_SA", // Australian National
  7004: "bessel",
  7005: "bess_nam", // Bessel Namibia
  7008: "clrk66",
  7010: "clrk66", // Clarke 1880 (Benoit)
  7012: "clrk80",
  7013: "clrk80", // Clarke 1880 (Arc)
  7014: "clrk80", // Clarke 1880 (SGA 1922)
  7015: "evrst30", // Everest 1830
  7016: "evrst48", // Everest 1830 (1948)
  7018: "evrst69", // Everest 1830 Modified
  7019: "GRS80",
  7020: "helmert", // Helmert 1906
  7021: "intl", // International 1909 (Hayford)
  7022: "intl",
  7024: "krass", // Krassowsky 1940
  7030: "WGS84",
  7034: "clrk80", // Clarke 1880
  7036: "GRS67", // GRS 1967
  7043: "WGS72",
  7044: "WGS66",
  7049: "fschr60", // Fischer 1960 (Mercury)
  7052: "plessis", // Plessis 1817
  7053: "evrst56", // Everest 1830 (1956)
};

// EPSG prime meridian codes → proj4 +pm values
const PRIME_MERIDIAN_MAP: Record<number, string> = {
  8901: "greenwich",
  8902: "lisbon",
  8903: "paris",
  8904: "bogota",
  8905: "madrid",
  8906: "rome",
  8907: "bern",
  8908: "jakarta",
  8909: "ferro",
  8910: "brussels",
  8911: "stockholm",
  8912: "athens",
  8913: "oslo",
};

// EPSG angular unit codes → conversion factor to degrees
// EPSG angular unit codes → conversion factor to degrees
// Codes not listed (including 9102 = degrees) default to factor 1
const ANGULAR_UNIT_TO_DEG: Record<number, number> = {
  9101: 180 / Math.PI, // radians
  9105: 0.9, // grads (1 grad = 0.9 degrees)
  9106: 1 / 3600, // arc-seconds
  9109: (180 / Math.PI) * 1e-6, // microradians
};

// EPSG linear unit codes → conversion factor to meters
// Only for codes not in LINEAR_UNIT_MAP (which handles m/ft/us-ft via +units=)
const LINEAR_UNIT_TO_METER: Record<number, number> = {
  9005: 0.30479947153867626, // Clarke's foot
  9014: 1.8288, // fathom
  9030: 1852, // nautical mile
  9036: 1000, // kilometre
  9042: 1852, // nautical mile (alt code)
  9098: 0.31608, // German legal metre
};

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
  const x0 =
    geoKeys.ProjFalseEastingGeoKey ??
    geoKeys.ProjFalseOriginEastingGeoKey ??
    geoKeys.ProjCenterEastingGeoKey;
  if (x0 != null) parts.push(`+x_0=${x0}`);

  const y0 =
    geoKeys.ProjFalseNorthingGeoKey ??
    geoKeys.ProjFalseOriginNorthingGeoKey ??
    geoKeys.ProjCenterNorthingGeoKey;
  if (y0 != null) parts.push(`+y_0=${y0}`);

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
    const unitSize =
      geoKeys.ProjLinearUnitSizeGeoKey ??
      LINEAR_UNIT_TO_METER[geoKeys.ProjLinearUnitsGeoKey];
    if (unitSize != null && unitSize !== 1) {
      parts.push(`+to_meter=${unitSize}`);
    }
  }

  parts.push("+no_defs");
  return parts.join(" ");
}
