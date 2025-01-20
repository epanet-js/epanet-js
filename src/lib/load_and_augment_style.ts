import type { PreviewProperty } from "src/state/jotai";
// TODO: this is a UI concern that should be separate.
import type { Style } from "mapbox-gl";
import mapboxgl from "mapbox-gl";
import {
  emptyFeatureCollection,
  LINE_COLORS_SELECTED,
} from "src/lib/constants";
import type { ISymbolization, LayerConfigMap } from "src/types";
import {
  addMapboxStyle,
  addXYZStyle,
  addTileJSONStyle,
} from "src/lib/layer_config_adapters";
import { reservoirsLayer, pipesLayer, junctionsLayer } from "src/map/layers";
import { asColorExpression, asNumberExpression } from "src/lib/symbolization";
import { slotLayer } from "src/map/slots";
import { isFeatureOn } from "src/infra/feature-flags";
import { pipeArrows } from "src/map/layers/pipes";

function getEmptyStyle() {
  const style: mapboxgl.Style = {
    version: 8,
    name: "XYZ Layer",
    sprite: "mapbox://sprites/mapbox/streets-v8",
    glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
    sources: {},
    layers: [],
  };
  return style;
}

const FEATURES_POINT_LAYER_NAME = "features-symbol";
const FEATURES_POINT_LABEL_LAYER_NAME = "features-point-label";
const FEATURES_LINE_LABEL_LAYER_NAME = "features-line-label";
const FEATURES_LINE_LAYER_NAME = "features-line";

const emptyGeoJSONSource = {
  type: "geojson",
  data: emptyFeatureCollection,
  buffer: 0,
  tolerance: 0,
} as const;

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

export default async function loadAndAugmentStyle({
  layerConfigs,
  symbolization,
  previewProperty,
}: {
  layerConfigs: LayerConfigMap;
  symbolization: ISymbolization;
  previewProperty: PreviewProperty;
}): Promise<Style> {
  let style = getEmptyStyle();
  let id = 0;
  const layers = [...layerConfigs.values()].reverse();
  for (const layer of layers) {
    id++;
    switch (layer.type) {
      case "MAPBOX": {
        style = await addMapboxStyle(style, layer);
        break;
      }
      case "XYZ": {
        style = addXYZStyle(style, layer, id);
        break;
      }
      case "TILEJSON": {
        style = await addTileJSONStyle(style, layer, id);
        break;
      }
    }
  }
  addEditingLayers({ style, symbolization, previewProperty });

  return style;
}

export function addEditingLayers({
  style,
  symbolization,
  previewProperty,
}: {
  style: Style;
  symbolization: ISymbolization;
  previewProperty: PreviewProperty;
}) {
  style.sources["imported-features"] = emptyGeoJSONSource;
  style.sources["features"] = emptyGeoJSONSource;

  if (!style.layers) {
    throw new Error("Style unexpectedly had no layers");
  }

  style.layers = style.layers.concat(
    makeLayers({ symbolization, previewProperty }),
  );
}

export function makeLayers({
  symbolization,
  previewProperty,
}: {
  symbolization: ISymbolization;
  previewProperty: PreviewProperty;
}): mapboxgl.AnyLayer[] {
  return [
    pipesLayer({
      source: "imported-features",
      layerId: "imported-pipes",
      symbolization,
    }),
    pipesLayer({
      source: "features",
      layerId: "pipes",
      symbolization,
    }),
    !isFeatureOn("FLAG_MAPBOX_PIPE_RESULTS") && slotLayer("after-lines-slot"),
    isFeatureOn("FLAG_MAPBOX_PIPE_RESULTS") &&
      pipeArrows({
        source: "imported-features",
        layerId: "imported-pipe-arrows",
        symbolization,
      }),
    isFeatureOn("FLAG_MAPBOX_PIPE_RESULTS") &&
      pipeArrows({
        source: "features",
        layerId: "pipe-arrows",
        symbolization,
      }),
    junctionsLayer({
      source: "imported-features",
      layerId: "imported-junctions",
      symbolization,
    }),
    junctionsLayer({
      source: "features",
      layerId: "junctions",
      symbolization,
    }),
    reservoirsLayer({
      source: "features",
      layerId: "reservoirs",
      symbolization,
    }),
    reservoirsLayer({
      source: "imported-features",
      layerId: "imported-reservoirs",
      symbolization,
    }),
    ...(typeof previewProperty === "string"
      ? [
          {
            id: FEATURES_POINT_LABEL_LAYER_NAME,
            type: "symbol",
            source: "features",
            paint: LABEL_PAINT(symbolization, previewProperty),
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
            paint: LABEL_PAINT(symbolization, previewProperty),
            layout: LABEL_LAYOUT(previewProperty, "line"),
            filter: addPreviewFilter(
              CONTENT_LAYER_FILTERS[FEATURES_LINE_LAYER_NAME],
              previewProperty,
            ),
          } as mapboxgl.AnyLayer,
        ]
      : []),
  ].filter((l) => !!l) as mapboxgl.AnyLayer[];
}

function LABEL_PAINT(
  _symbolization: ISymbolization,
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

export function CIRCLE_PAINT(
  symbolization: ISymbolization,
): mapboxgl.CirclePaint {
  return {
    "circle-opacity": [
      "case",
      ["boolean", ["feature-state", "hidden"], false],
      0,
      asNumberExpression({
        symbolization,
        part: "circle-opacity",
        defaultValue: 1,
      }),
    ],
    "circle-stroke-color": [
      "match",
      ["feature-state", "selected"],
      "true",
      LINE_COLORS_SELECTED,
      "white",
    ],
    "circle-stroke-width": 0,
    "circle-radius": 6,
    "circle-color": [
      "match",
      ["feature-state", "selected"],
      "true",
      LINE_COLORS_SELECTED,
      asColorExpression({
        symbolization,
        part: "stroke",
      }),
    ],
  };
}

function handleSelected(
  expression: mapboxgl.Expression | string,
  exp = false,
  selected: mapboxgl.Expression | string,
) {
  return exp
    ? expression
    : ([
        "match",
        ["feature-state", "selected"],
        "true",
        selected,
        expression,
      ] as mapboxgl.Expression);
}

export function FILL_PAINT(
  symbolization: ISymbolization,
  exp = false,
): mapboxgl.FillPaint {
  return {
    "fill-opacity": [
      "case",
      ["boolean", ["feature-state", "hidden"], false],
      0,
      asNumberExpression({
        symbolization,
        part: "fill-opacity",
        defaultValue:
          typeof symbolization.defaultOpacity === "number"
            ? symbolization.defaultOpacity
            : 0.3,
      }),
    ],
    "fill-color": handleSelected(
      asColorExpression({ symbolization, part: "fill" }),
      exp,
      LINE_COLORS_SELECTED,
    ),
  };
}

export function LINE_PAINT(
  symbolization: ISymbolization,
  exp = false,
): mapboxgl.LinePaint {
  return {
    "line-opacity": [
      "case",
      ["boolean", ["feature-state", "hidden"], false],
      0,
      asNumberExpression({
        symbolization,
        part: "stroke-opacity",
        defaultValue: 1,
      }),
    ],
    "line-width": asNumberExpression({
      symbolization,
      part: "stroke-width",
      defaultValue: 4,
    }),
    "line-color": handleSelected(
      asColorExpression({ symbolization, part: "stroke" }),
      exp,
      LINE_COLORS_SELECTED,
    ),
  };
}
