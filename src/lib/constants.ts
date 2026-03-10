import type { IFeatureCollection } from "src/types";

/**
 * Layer names
 */

export const DECK_SYNTHETIC_ID = "deckgl-synthetic";

/**
 * Colors
 */

export const colors = {
  cyan900: "#083344",
  cyan800: "#0e7490",
  cyan700: "#06b6d4",
  cyan600: "#22d3ee",
  cyan500: "#06b6d4",
  cyan400: "#67e8f9",
  cyan300: "#a5f3fc",
  cyan200: "#cffafe",
  cyan100: "#e0f8fa",
  cyan50: "#ecfeff",
  sky300: "#b8e6fe",
  blue500: "#2b7fff",
  purple900: "#581c87",
  purple800: "#6b21a8",
  purple700: "#7e22ce",
  purple600: "#9333ea",
  purple500: "#a855f7",
  purple400: "#c084fc",
  purple300: "#d8b4fe",
  purple200: "#e9d5ff",
  purple100: "#f3e8ff",
  purple50: "#faf5ff",
  indigo900: "#312E81",
  indigo800: "#3730a3",
  indigo50: "#eef2ff",
  indigo100: "#e0e7ff",
  indigo200: "#c7d2fe",
  indigo300: "#a5b4fc",
  indigo400: "#818cf8",
  indigo500: "#6366f1",
  indigo600: "#4f46e5",
  fuchsia600: "#c026d3",
  fuchsia500: "#d946ef",
  fuchsia400: "#e879f9",
  fuchsia300: "#f0abfc",
  fuchsia200: "#fae8ff",
  fuchsia100: "#fdf4ff",
  amber500: "#fd9a00",
  amber300: "#fee685",
  amber800: "#6C5B37",
  orange800: "#705A31",
  yellow600: "#C6C95C",
  yellow800: "#7A6F35",
  yellow700: "#9A9238",
  orange500: "#f97316",
  orange700: "#c2410c",
  red100: "#fee2e2",
  red300: "#fca5a5",
  red600: "#e7000b",
  red700: "#b91c1c",
  green100: "#dcfce7",
  green300: "#86efac",
  green800: "#166534",
  gray100: "#f3f4f6",
  gray300: "#d1d5db",
  gray400: "#9ca3af",
  gray500: "#6b7280",
  gray600: "#4b5563",
  gray700: "#374151",
  zinc400: "#a1a1aa",
};

export const LINE_COLORS_SELECTED = colors.fuchsia500;

/**
 * Utilities ------------------------------------------------------------------
 */
export const targetSize = [160, 160] as const;

/**
 * Errors that we can represent by redirecting to a page
 * with the error code.
 *
 * This is to avoid the possibility of an ?error=Message…
 * query, which could be a reflection attack.
 */
export const ERROR_CODES = {
  SSO_ORGANIZATION_NO_ID:
    "This organization is set up with SSO but does not have an active SSO provider.",
  SSO_ORGANIZATION_MISSING:
    "This organization is set up with SSO but not connected in Placemark.",
  GITHUB_TOKEN_MISSING:
    "You were redirected back to Placemark after authenticating with GitHub, but the token was missing.",
} as const;

export const SUPPORT_EMAIL = "support@epanetjs.com";

export const CURSOR_DEFAULT = "";

export const EMPTY_ARRAY: any[] = [];

export const emptyFeatureCollection: IFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};
