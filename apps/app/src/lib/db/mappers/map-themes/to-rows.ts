import {
  mapThemeRowSchema,
  mapThemeSpecSchema,
  parseRows,
  type MapThemeRow,
  type MapThemeSpec,
} from "@epanet-js/ejsdb";
import type { RangeColorRule } from "src/map/symbology/range-color-rule";
import type { MapTheme, MapThemeSymbology } from "src/state/map-themes";

export type ColorFields = {
  colorBy: string | null;
  mode: RangeColorRule["mode"] | null;
  ramp: string | null;
  reversed: boolean | null;
  colors: string[] | null;
  breaks: number[] | null;
};

const toColorFields = (rule: RangeColorRule | null): ColorFields =>
  rule
    ? {
        colorBy: rule.property,
        mode: rule.mode,
        ramp: rule.rampName,
        reversed: Boolean(rule.reversedRamp),
        colors: [...rule.colors],
        breaks: [...rule.breaks],
      }
    : {
        colorBy: null,
        mode: null,
        ramp: null,
        reversed: null,
        colors: null,
        breaks: null,
      };

export const toMapThemeSpec = (symbology: MapThemeSymbology): MapThemeSpec => {
  const node = toColorFields(symbology.node.colorRule);
  const link = toColorFields(symbology.link.colorRule);
  return {
    nodeColor: symbology.node.defaults.color,
    nodeLabel: symbology.node.labelRule,
    nodeSizeMinVisibleZoom: symbology.nodeSize.minVisibleZoom,
    nodeSizeMin: symbology.nodeSize.minSize,
    nodeSizeMax: symbology.nodeSize.maxSize,
    nodeColorBy: node.colorBy,
    nodeColorMode: node.mode,
    nodeColorRamp: node.ramp,
    nodeColorRampReversed: node.reversed,
    nodeColors: node.colors,
    nodeBreaks: node.breaks,

    linkColor: symbology.link.defaults.color,
    linkLabel: symbology.link.labelRule,
    linkColorBy: link.colorBy,
    linkColorMode: link.mode,
    linkColorRamp: link.ramp,
    linkColorRampReversed: link.reversed,
    linkColors: link.colors,
    linkBreaks: link.breaks,

    zonesVisible: symbology.zone.visible,
    zonesColor: symbology.zone.defaults.color,
    zonesLabel: symbology.zone.labelRule,
    zonesColorBy: symbology.zone.colorRule,
    zonesPalette: symbology.zone.paletteName,

    customerPointsVisible: symbology.customerPoints.visible,

    basemapStyle: symbology.basemap.style,
    basemapVisible: symbology.basemap.visible,
    basemapLabels: symbology.basemap.labels,
    basemapOpacity: symbology.basemap.opacity,
  };
};

const mapThemeToRow = (theme: MapTheme): MapThemeRow => ({
  id: theme.id,
  name: theme.name,
  spec: JSON.stringify(mapThemeSpecSchema.parse(theme.spec)),
});

export const serializeMapThemes = (
  themes: readonly MapTheme[],
): MapThemeRow[] =>
  parseRows(mapThemeRowSchema, themes.map(mapThemeToRow), "Map theme");

export const serializeMapTheme = (theme: MapTheme): MapThemeRow =>
  serializeMapThemes([theme])[0];
