import type { Style } from "mapbox-gl";
import { LayerConfigMap } from "src/types";
import {
  addMapboxStyle,
  addXYZStyle,
  addTileJSONStyle,
} from "src/lib/layer-config-adapters";
import { emptyFeatureCollection } from "src/lib/constants";

function getEmptyStyle() {
  const style: Style = {
    version: 8,
    name: "XYZ Layer",
    sprite: "mapbox://sprites/mapbox/streets-v8",
    glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
    sources: {},
    layers: [],
  };
  return style;
}

const emptyGeoJSONSource = {
  type: "geojson",
  data: emptyFeatureCollection,
  buffer: 4,
  tolerance: 0,
} as const;

export async function buildBaseStyle({
  layerConfigs,
  translate,
}: {
  layerConfigs: LayerConfigMap;
  translate: (key: string) => string;
}): Promise<Style> {
  let style = getEmptyStyle();
  let id = 0;
  const layers = [...layerConfigs.values()].reverse();
  for (const layer of layers) {
    id++;
    switch (layer.type) {
      case "MAPBOX": {
        style = await addMapboxStyle(style, layer, translate);
        break;
      }
      case "XYZ": {
        style = addXYZStyle(style, layer, id);
        break;
      }
      case "TILEJSON": {
        style = await addTileJSONStyle(style, layer, id, translate);
        break;
      }
    }
  }

  defineEmptySources(style);

  return style;
}

export function defineEmptySources(style: Style) {
  style.sources["imported-features"] = emptyGeoJSONSource;
  style.sources["features"] = emptyGeoJSONSource;
  style.sources["icons"] = emptyGeoJSONSource;
  style.sources["selected-features"] = emptyGeoJSONSource;
  style.sources["ephemeral"] = emptyGeoJSONSource;
}

import type { PreviewProperty } from "src/state/jotai";
import type { ISymbology } from "src/types";
import { reservoirLayers, pipesLayer, junctionsLayer } from "src/map/layers";
import { pipeArrows, checkValveIcons } from "src/map/layers/pipes";
import { junctionResultsLayer } from "src/map/layers/junctions";
import { pumpIcons, pumpLines } from "src/map/layers/pumps";
import { valveIcons, valveLines } from "src/map/layers/valves";
import { linkLabelsLayer } from "src/map/layers/link-labels";
import { nodeLabelsLayer } from "src/map/layers/node-labels";
import { tankLayers } from "src/map/layers/tank";
import {
  ephemeralDraftLineLayer,
  ephemeralIconHighlightLayers,
  ephemeralJunctionHighlightLayers,
  ephemeralHaloLayer,
  ephemeralPipeHighlightLayer,
  ephemeralShadowLineLayer,
  ephemeralSelectionFillLayer,
  ephemeralSelectionOutlineLayer,
} from "src/map/layers/ephemeral-state";
import {
  selectedPipesLayer,
  selectedPumpLinesLayer,
  selectedValveLinesLayer,
  selectedJunctionsLayer,
  selectedIconsLayer,
  selectedIconsHaloLayer,
  selectedPipeArrowsLayer,
} from "src/map/layers/selection";
import type * as mapboxgl from "mapbox-gl";

const FEATURES_POINT_LABEL_LAYER_NAME = "features-point-label";
const FEATURES_LINE_LABEL_LAYER_NAME = "features-line-label";
const FEATURES_LINE_LAYER_NAME = "features-line";
const FEATURES_POINT_LAYER_NAME = "features-symbol";

const CONTENT_LAYER_FILTERS: {
  [key: string]: mapboxgl.Layer["filter"];
} = {
  [FEATURES_LINE_LAYER_NAME]: [
    "any",
    ["==", "$type", "LineString"],
    ["==", "$type", "Polygon"],
  ],
  [FEATURES_POINT_LAYER_NAME]: ["all", ["==", "$type", "Point"]],
};

function addPreviewFilter(
  filters: mapboxgl.Layer["filter"],
  previewProperty: PreviewProperty,
): mapboxgl.Layer["filter"] {
  if (!previewProperty) return filters;
  return ["all", filters, ["has", previewProperty]];
}

function LABEL_PAINT(
  _symbology: ISymbology,
  _previewProperty: PreviewProperty,
): mapboxgl.SymbolPaint {
  const paint: mapboxgl.SymbolPaint = {
    "text-halo-color": "#fff",
    "text-halo-width": 1,
    "text-halo-blur": 0.8,
  };
  return paint;
}

function LABEL_LAYOUT(
  previewProperty: PreviewProperty,
  placement: mapboxgl.SymbolLayout["symbol-placement"],
): mapboxgl.SymbolLayout {
  const paint: mapboxgl.SymbolLayout = {
    "text-field": ["get", previewProperty],
    "text-variable-anchor": ["top", "bottom", "left", "right"],
    "text-radial-offset": 0.5,
    "symbol-placement": placement,
    "icon-optional": true,
    "text-size": 13,
    "text-justify": "auto",
  };
  return paint;
}

export function makeLayers({
  symbology,
  previewProperty,
}: {
  symbology: ISymbology;
  previewProperty: PreviewProperty;
}): mapboxgl.AnyLayer[] {
  return [
    ephemeralHaloLayer({ source: "ephemeral" }),
    pipesLayer({
      source: "imported-features",
      layerId: "imported-pipes",
      symbology,
    }),
    pipesLayer({
      source: "features",
      layerId: "pipes",
      symbology,
    }),
    selectedPipesLayer({
      source: "selected-features",
      layerId: "selected-pipes",
    }),
    pumpLines({
      source: "imported-features",
      layerId: "imported-pump-lines",
      symbology,
    }),
    pumpLines({
      source: "features",
      layerId: "pump-lines",
      symbology,
    }),
    selectedPumpLinesLayer({
      source: "selected-features",
      layerId: "selected-pump-lines",
    }),
    valveLines({
      source: "imported-features",
      layerId: "imported-valve-lines",
      symbology,
    }),
    valveLines({
      source: "features",
      layerId: "valve-lines",
      symbology,
    }),
    selectedValveLinesLayer({
      source: "selected-features",
      layerId: "selected-valve-lines",
    }),
    ephemeralShadowLineLayer({ source: "ephemeral" }),
    ephemeralDraftLineLayer({ source: "ephemeral" }),
    ephemeralPipeHighlightLayer({ source: "ephemeral" }),
    pipeArrows({
      source: "imported-features",
      layerId: "imported-pipe-arrows",
      symbology,
    }),
    pipeArrows({
      source: "features",
      layerId: "pipe-arrows",
      symbology,
    }),
    selectedPipeArrowsLayer({
      source: "selected-features",
      layerId: "selected-pipe-arrows",
    }),
    junctionsLayer({
      source: "imported-features",
      layerId: "imported-junctions",
      symbology,
    }),
    junctionsLayer({
      source: "features",
      layerId: "junctions",
      symbology,
    }),
    selectedJunctionsLayer({
      source: "selected-features",
      layerId: "selected-junctions",
    }),
    junctionResultsLayer({
      source: "imported-features",
      layerId: "imported-junction-results",
      symbology,
    }),
    junctionResultsLayer({
      source: "features",
      layerId: "junction-results",
      symbology,
    }),
    selectedIconsHaloLayer({
      source: "selected-features",
      layerId: "selected-icons-halo",
    }),
    ...valveIcons({
      source: "icons",
      layerId: "valve-icons",
    }),
    checkValveIcons({
      source: "icons",
      layerId: "check-valve-icons",
    }),
    pumpIcons({
      source: "icons",
      layerId: "pump-icons",
      symbology,
    }),
    ...reservoirLayers({ sources: ["icons"] }),
    ...tankLayers({ sources: ["icons"] }),
    selectedIconsLayer({
      source: "selected-features",
      layerId: "selected-icons",
    }),
    ephemeralJunctionHighlightLayers({ source: "ephemeral" }),
    ephemeralIconHighlightLayers({ source: "ephemeral" }),
    ...linkLabelsLayer({ sources: ["imported-features", "features"] }),
    ...nodeLabelsLayer({ sources: ["imported-features", "features"] }),
    ...(typeof previewProperty === "string"
      ? [
          {
            id: FEATURES_POINT_LABEL_LAYER_NAME,
            type: "symbol",
            source: "features",
            paint: LABEL_PAINT(symbology, previewProperty),
            layout: LABEL_LAYOUT(previewProperty, "point"),
            filter: addPreviewFilter(
              CONTENT_LAYER_FILTERS[FEATURES_POINT_LAYER_NAME],
              previewProperty,
            ),
          } as mapboxgl.AnyLayer,
          {
            id: FEATURES_LINE_LABEL_LAYER_NAME,
            type: "symbol",
            source: "features",
            paint: LABEL_PAINT(symbology, previewProperty),
            layout: LABEL_LAYOUT(previewProperty, "line"),
            filter: addPreviewFilter(
              CONTENT_LAYER_FILTERS[FEATURES_LINE_LAYER_NAME],
              previewProperty,
            ),
          } as mapboxgl.AnyLayer,
        ]
      : []),
    ephemeralSelectionFillLayer({ source: "ephemeral" }),
    ephemeralSelectionOutlineLayer({ source: "ephemeral" }),
  ].filter((l) => !!l);
}
