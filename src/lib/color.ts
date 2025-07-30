import randomColor from "randomcolor";
import type { IPresence } from "src/types";
import * as d3 from "d3-color";
import chroma from "chroma-js";

const purple900a: RGBA = [49, 46, 129, 255];

/**
 * Always returns a color triplet.
 * Will return purple900 if the color can't be parsed.
 */
export function hexToArray(color: string, alpha?: number): RGBA {
  const c = d3.color(color);
  if (!c) {
    return purple900a;
  }
  const rgb = c.rgb();
  const opacity = alpha === undefined ? rgb.opacity : alpha;
  return [rgb.r, rgb.g, rgb.b, Math.floor(opacity * 255)];
}

export function colorFromPresence(presence: IPresence) {
  return randomColor({ seed: presence.userId * 10, luminosity: "dark" });
}

/**
 * Generate a CSS linear gradient from a list of colors
 */
export function linearGradient({
  colors,
  interpolate,
  vertical = false,
}: {
  colors: string[];
  interpolate: "step" | "linear";
  vertical?: boolean;
}) {
  const angle = vertical ? "180deg" : "90deg";
  const percent = 100 / colors.length;
  const steps = colors.map((color, i) =>
    interpolate === "step"
      ? `${color} ${percent * i}%, ${color} ${percent * (i + 1)}%`
      : `${color} ${percent * i}%`,
  );
  return `linear-gradient(${angle}, ${steps.join(",")})`;
}

export const strokeColorFor = (fillColor: string): string => {
  const minLightness = 0.75;
  const maxLightness = 0.95;
  const luminanceThreshold = 0.45;
  const color = chroma(fillColor);
  const luminance = color.luminance(); // Get luminance (0 = dark, 1 = light)

  let strokeColor = color;

  if (luminance > luminanceThreshold) {
    // Light color: Darken the stroke
    strokeColor = strokeColor.set(
      "oklch.l",
      minLightness
    );
    // Adjust saturation
    strokeColor = strokeColor.set(
      "lch.c",
      35,
    );
  } else {
    // Dark color: Lighten the stroke
    strokeColor = strokeColor.set(
      "oklch.l",
      maxLightness
    );
    // Adjust saturation
    strokeColor = strokeColor.set(
      "lch.c",
      25,
    );
  }

  return strokeColor.hex();
};
