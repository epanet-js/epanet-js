import randomColor from "randomcolor";
import type { IPresence, RampValues } from "src/types";
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
}: { colors: string[] } & Pick<RampValues, "interpolate">) {
  const percent = 100 / colors.length;
  const steps = colors.map((color, i) =>
    interpolate === "step"
      ? `${color} ${percent * i}%, ${color} ${percent * (i + 1)}%`
      : `${color} ${percent * i}%`,
  );
  return `linear-gradient(90deg, ${steps.join(",")}`;
}

export const strokeColorFor = (fillColor: string): string => {
  const brightnessAdjust = 0.5;
  const saturationAdjust = 0.2;
  const color = chroma(fillColor);
  const luminance = color.luminance(); // Get luminance (0 = dark, 1 = light)

  let strokeColor = color;

  if (luminance > 0.5) {
    // Light color: Darken the stroke
    strokeColor = strokeColor.darken(Math.abs(brightnessAdjust));
  } else {
    // Dark color: Lighten the stroke
    strokeColor = strokeColor.brighten(Math.abs(brightnessAdjust + 1));
  }

  // Adjust saturation
  strokeColor = strokeColor.set(
    "hsl.s",
    Math.min(1, Math.max(0, color.get("hsl.s") + saturationAdjust)),
  );

  return strokeColor.hex();
};
