import type { Unit } from "@epanet-js/quantity";
import chroma from "chroma-js";

export type RenderColorRule = {
  property: string;
  unit: Unit;
  breaks: number[];
  colors: string[];
  absValues?: boolean;
};

export type LabelRule = string | null;

export const assetLabelRule: LabelRule = "label";

export type RenderAssetSymbology = {
  colorRule: RenderColorRule | null;
  labelRule: LabelRule | null;
  defaults: { color: string };
};

export type RenderSymbology = {
  node: RenderAssetSymbology;
  link: RenderAssetSymbology;
};

export type NodeSizeConfig = {
  // Zoom at which junctions reach minSize; below it the radius clamps to minSize.
  minVisibleZoom: number;
  // Radius (px) at minVisibleZoom.
  minSize: number;
  // Radius (px) at the maximum map zoom.
  maxSize: number;
};

// Maps a value to its color per the render rule's step ramp. Pure render logic
// (reads only breaks/colors/absValues) shared by the geojson and tile encoders.
export const colorFor = (colorRule: RenderColorRule, value: number): string => {
  const { absValues, colors, breaks } = colorRule;
  const effectiveValue = absValues ? Math.abs(value) : value;

  if (effectiveValue < breaks[0]) return colors[0];
  if (effectiveValue >= breaks[breaks.length - 1])
    return colors[colors.length - 1];

  for (let i = 0; i < breaks.length - 1; i++) {
    if (effectiveValue >= breaks[i] && effectiveValue < breaks[i + 1])
      return colors[i + 1];
  }

  throw new Error("Value without color");
};

// Derives a contrasting stroke color for a given fill: darkens light fills and
// lightens dark ones (keeping hue) so asset outlines stay visible on any fill.
export const strokeColorFor = (fillColor: string): string => {
  const minLightness = 0.75;
  const maxLightness = 0.95;
  const luminanceThreshold = 0.45;
  const lightColorSaturation = 35;
  const darkColorSaturation = 25;
  const color = chroma(fillColor);
  const luminance = color.luminance(); // Get luminance (0 = dark, 1 = light)

  let strokeColor = color;

  if (luminance > luminanceThreshold) {
    // Light color: Darken the stroke
    strokeColor = strokeColor.set("oklch.l", minLightness);
    // Adjust saturation
    strokeColor = strokeColor.set("lch.c", lightColorSaturation);
  } else {
    // Dark color: Lighten the stroke
    strokeColor = strokeColor.set("oklch.l", maxLightness);
    // Adjust saturation
    strokeColor = strokeColor.set("lch.c", darkColorSaturation);
  }

  return strokeColor.hex();
};
