import {
  mapThemeRowSchema,
  mapThemeSpecSchema,
  parseRows,
  type MapThemeSpec,
} from "@epanet-js/ejsdb";
import {
  supportedLinkProperties,
  supportedNodeProperties,
  type LabelRule,
  type SupportedProperty,
  type ZoneColorRule,
  type ZoneLabelRule,
} from "src/map/symbology/symbology-types";
import type { RangeColorRule } from "src/map/symbology/range-color-rule";
import type { MapTheme, MapThemeSymbology } from "src/state/map-themes";
import type { ColorFields } from "./to-rows";

export type ThemeColorRule = Pick<
  RangeColorRule,
  "mode" | "rampName" | "colors" | "breaks"
> & {
  property: SupportedProperty;
  reversedRamp: boolean;
};

const fromColorFields = (
  fields: ColorFields,
  knownProperties: readonly string[],
): ThemeColorRule | null => {
  const { colorBy, mode, ramp, colors, breaks } = fields;
  if (colorBy === null || !knownProperties.includes(colorBy)) return null;
  if (mode === null || ramp === null || colors === null || breaks === null)
    return null;
  return {
    property: colorBy as SupportedProperty,
    mode,
    rampName: ramp,
    reversedRamp: Boolean(fields.reversed),
    colors,
    breaks,
  };
};

const zoneRule = (value: string | null): ZoneLabelRule & ZoneColorRule =>
  value === "label" ? "label" : null;

const assetLabelRule = (
  value: string | null,
  knownProperties: readonly string[],
): LabelRule =>
  value === "label" || (value !== null && knownProperties.includes(value))
    ? value
    : null;

const buildMapThemeSpec = (json: string): MapThemeSpec => {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    throw new Error("Map theme: spec is not valid JSON", { cause: error });
  }

  const result = mapThemeSpecSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Map theme: spec does not match schema — ${result.error.message}`,
    );
  }
  return result.data;
};

export const buildMapThemesData = (rawRows: unknown[]): MapTheme[] =>
  parseRows(mapThemeRowSchema, rawRows, "Map theme").map((row) => ({
    id: row.id,
    name: row.name,
    spec: buildMapThemeSpec(row.spec),
  }));

export const buildMapThemeSymbology = (
  spec: MapThemeSpec,
  resolveColorRule: (rule: ThemeColorRule) => RangeColorRule,
): MapThemeSymbology => {
  const resolve = (rule: ThemeColorRule | null) =>
    rule ? resolveColorRule(rule) : null;

  return {
    node: {
      defaults: { color: spec.nodeColor },
      labelRule: assetLabelRule(spec.nodeLabel, supportedNodeProperties),
      colorRule: resolve(
        fromColorFields(
          {
            colorBy: spec.nodeColorBy,
            mode: spec.nodeColorMode,
            ramp: spec.nodeColorRamp,
            reversed: spec.nodeColorRampReversed,
            colors: spec.nodeColors,
            breaks: spec.nodeBreaks,
          },
          supportedNodeProperties,
        ),
      ),
    },
    nodeSize: {
      minVisibleZoom: spec.nodeSizeMinVisibleZoom,
      minSize: spec.nodeSizeMin,
      maxSize: spec.nodeSizeMax,
    },
    link: {
      defaults: { color: spec.linkColor },
      labelRule: assetLabelRule(spec.linkLabel, supportedLinkProperties),
      colorRule: resolve(
        fromColorFields(
          {
            colorBy: spec.linkColorBy,
            mode: spec.linkColorMode,
            ramp: spec.linkColorRamp,
            reversed: spec.linkColorRampReversed,
            colors: spec.linkColors,
            breaks: spec.linkBreaks,
          },
          supportedLinkProperties,
        ),
      ),
    },
    zone: {
      visible: spec.zonesVisible,
      defaults: { color: spec.zonesColor },
      labelRule: zoneRule(spec.zonesLabel),
      colorRule: zoneRule(spec.zonesColorBy),
      paletteName: spec.zonesPalette,
    },
    customerPoints: { visible: spec.customerPointsVisible },
  };
};
