/**
 * GeoTIFF 1.1 spec constants (OGC 19-008r4).
 *
 * All lookup tables, EPSG code mappings, and GeoKey magic numbers
 * used to interpret GeoTIFF metadata live here.
 */

import type { CrsUnit, LinearUnit } from "./types";

/** proj4 +units string → CrsUnit */
export const PROJ4_UNITS_MAP: Record<string, CrsUnit> = {
  m: "m",
  ft: "ft",
  "us-ft": "us-ft",
};

/** CRS unit → app-level linear unit (collapses us-ft to ft) */
export const CRS_UNIT_TO_APP_UNIT: Record<CrsUnit, "m" | "ft"> = {
  deg: "m", // geographic CRS — elevation values default to meters
  m: "m",
  ft: "ft",
  "us-ft": "ft", // close enough — 0.01% difference
};

// ---------------------------------------------------------------------------
// GeoKey model types (GTModelTypeGeoKey)
// ---------------------------------------------------------------------------
export const GT_MODEL_TYPE_PROJECTED = 1;
export const GT_MODEL_TYPE_GEOGRAPHIC = 2;
export const GT_MODEL_TYPE_GEOCENTRIC = 3;

// ---------------------------------------------------------------------------
// GTRasterTypeGeoKey
// ---------------------------------------------------------------------------
export const RASTER_PIXEL_IS_POINT = 2;

// ---------------------------------------------------------------------------
// Special codes
// ---------------------------------------------------------------------------
export const USER_DEFINED_CODE = 32767;
export const WGS84_GEOGRAPHIC_CODES = new Set([4326, 4269]);

// ---------------------------------------------------------------------------
// ProjCoordTransGeoKey → proj4 projection name
// Values 1-27 from GeoTIFF spec Annex C, Table C.1
// ---------------------------------------------------------------------------
export const CT_TRANSV_MERCATOR_SOUTH_ORIENTED = 27;

export const PROJ_COORD_TRANS_MAP: Record<number, string> = {
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

// ---------------------------------------------------------------------------
// EPSG ellipsoid codes → proj4 +ellps values
// ---------------------------------------------------------------------------
export const ELLIPSOID_MAP: Record<number, string> = {
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

// ---------------------------------------------------------------------------
// EPSG prime meridian codes → proj4 +pm values
// ---------------------------------------------------------------------------
export const PM_GREENWICH = 8901;

export const PRIME_MERIDIAN_MAP: Record<number, string> = {
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

// ---------------------------------------------------------------------------
// Unit mappings
// ---------------------------------------------------------------------------

/** ProjLinearUnitsGeoKey / VerticalUnitsGeoKey → LinearUnit */
export const LINEAR_UNIT_MAP: Record<number, LinearUnit> = {
  9001: "m",
  9002: "ft",
  9003: "us-ft",
};

/** EPSG angular unit codes → conversion factor to degrees.
 *  Codes not listed (including 9102 = degrees) default to factor 1. */
export const ANGULAR_UNIT_TO_DEG: Record<number, number> = {
  9101: 180 / Math.PI, // radians
  9105: 0.9, // grads (1 grad = 0.9 degrees)
  9106: 1 / 3600, // arc-seconds
  9109: (180 / Math.PI) * 1e-6, // microradians
};

/** EPSG linear unit codes → conversion factor to meters */
export const LINEAR_UNIT_TO_METER: Record<number, number> = {
  9001: 1, // metre
  9002: 0.3048, // international foot
  9003: 0.3048006096012192, // US survey foot
  9005: 0.30479947153867626, // Clarke's foot
  9014: 1.8288, // fathom
  9030: 1852, // nautical mile
  9036: 1000, // kilometre
  9040: 0.3047997101815088, // British foot (Sears 1922)
  9042: 1852, // nautical mile (alt code)
  9084: 0.30479951024814694, // Indian foot
  9093: 1609.344, // statute mile
  9094: 0.3047997101815088, // Gold Coast foot
  9095: 0.3048007491, // British foot (1936)
  9096: 0.9144, // yard (international)
  9098: 0.31608, // German legal metre
  9300: 0.3048, // British foot (Sears 1922 truncated)
  9301: 0.30479841408177483, // Indian foot (1937)
  9302: 0.3047996664, // Indian foot (1962)
  9303: 0.3047995, // Indian foot (1975)
};

// ---------------------------------------------------------------------------
// VerticalCSTypeGeoKey codes that use non-meter units.
// Only ~14 out of ~279 EPSG vertical CRS use feet; everything else defaults to meters.
// ---------------------------------------------------------------------------
export const VERTICAL_CRS_NON_METER: Record<number, LinearUnit> = {
  6360: "us-ft", // NAVD88 height (ftUS)
  6358: "ft", // NAVD88 height (ft)
  5715: "ft", // MSL depth (ft)
  6638: "us-ft", // PRVD02 height (ftUS)
  6644: "us-ft", // GUVD04 height (ftUS)
  6640: "us-ft", // NMVD03 height (ftUS)
  6642: "us-ft", // ASVD02 height (ftUS)
  6130: "us-ft", // GCVD54 height (ftUS)
};
