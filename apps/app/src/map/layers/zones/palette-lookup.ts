import {
  COLORBREWER_QUAL,
  CARTO_COLOR_QUALITATIVE,
  type CBColors,
} from "src/lib/colorbrewer";

export const QUALITATIVE_PALETTES: CBColors[] = [
  ...CARTO_COLOR_QUALITATIVE,
  ...COLORBREWER_QUAL,
];

export const DEFAULT_ZONE_PALETTE_NAME = "Bold";

const rgbStringToHex = (rgb: string): string => {
  const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return rgb;
  const [, r, g, b] = match;
  return `#${[r, g, b].map((c) => Number(c).toString(16).padStart(2, "0")).join("")}`;
};

const normalizeColor = (color: string): string =>
  color.startsWith("rgb(") ? rgbStringToHex(color) : color;

export const getQualitativePaletteColors = (paletteName: string): string[] => {
  const palette =
    QUALITATIVE_PALETTES.find((p) => p.name === paletteName) ??
    QUALITATIVE_PALETTES.find((p) => p.name === DEFAULT_ZONE_PALETTE_NAME)!;

  const maxKey = Math.max(
    ...Object.keys(palette.colors).map(Number),
  ) as keyof CBColors["colors"];
  const colors = palette.colors[maxKey]!;

  const normalized = colors.map(normalizeColor);

  // CARTO qualitative palettes append a neutral gray swatch as the last color
  if ((palette.tags as string[] | undefined)?.includes("qualitative")) {
    return normalized.slice(0, -1);
  }
  return normalized;
};
