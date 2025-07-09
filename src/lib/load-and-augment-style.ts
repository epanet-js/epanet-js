import type { PreviewProperty } from "src/state/jotai";
// TODO: this is a UI concern that should be separate.
import type { Style } from "mapbox-gl";
import mapboxgl from "mapbox-gl";
import {
  emptyFeatureCollection,
  LINE_COLORS_SELECTED,
} from "src/lib/constants";
import type { ISymbology, LayerConfigMap } from "src/types";
import {
  addMapboxStyle,
  addXYZStyle,
  addTileJSONStyle,
} from "src/lib/layer-config-adapters";
import {
  reservoirsLayerDeprecated,
  reservoirLayers,
  pipesLayer,
  junctionsLayer,
} from "src/map/layers";
import {
  asColorExpression,
  asNumberExpression,
} from "src/lib/symbolization-deprecated";
import { pipeArrows } from "src/map/layers/pipes";
import { junctionResultsLayer } from "src/map/layers/junctions";
import { pumpIcons, pumpLines } from "src/map/layers/pumps";
import { valveIcons, valveLines } from "src/map/layers/valves";
import { linkLabelsLayer } from "src/map/layers/link-labels";
import { nodeLabelsLayer } from "src/map/layers/node-labels";
import { tankLayers } from "src/map/layers/tank";
import {
  draftLineLayer,
  snappingCandidateLayer,
} from "src/map/layers/ephemeral-state";

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
  buffer: 4,
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
  symbology,
  previewProperty,
  translate,
  isTankFlagOn,
}: {
  layerConfigs: LayerConfigMap;
  symbology: ISymbology;
  previewProperty: PreviewProperty;
  translate: (key: string) => string;
  isTankFlagOn: boolean;
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

  addEditingLayers({ style, symbology, previewProperty, isTankFlagOn });

  return style;
}

export function addEditingLayers({
  style,
  symbology,
  previewProperty,
  isTankFlagOn,
}: {
  style: Style;
  symbology: ISymbology;
  previewProperty: PreviewProperty;
  isTankFlagOn: boolean;
}) {
  style.sources["imported-features"] = emptyGeoJSONSource;
  style.sources["features"] = emptyGeoJSONSource;
  style.sources["icons"] = emptyGeoJSONSource;

  if (isTankFlagOn) {
    style.sources["ephemeral-state"] = emptyGeoJSONSource;
  }

  if (!style.layers) {
    throw new Error("Style unexpectedly had no layers");
  }

  style.layers = style.layers.concat(
    makeLayers({ symbology, previewProperty, isTankFlagOn }),
  );
}

export function makeLayers({
  symbology,
  previewProperty,
  isTankFlagOn,
}: {
  symbology: ISymbology;
  previewProperty: PreviewProperty;
  isTankFlagOn: boolean;
}): mapboxgl.AnyLayer[] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return [
    ...(isTankFlagOn
      ? [snappingCandidateLayer({ source: "ephemeral-state" })]
      : []),
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
    ...(isTankFlagOn ? [draftLineLayer({ source: "ephemeral-state" })] : []),
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
    ...valveIcons({
      source: "icons",
      layerId: "valve-icons",
    }),
    ...pumpIcons({
      source: "icons",
      layerId: "pump-icons",
      symbology,
    }),
    ...(isTankFlagOn
      ? reservoirLayers({ sources: ["icons"] })
      : [
          reservoirsLayerDeprecated({
            source: "features",
            layerId: "reservoirs",
            symbology,
          }),
          reservoirsLayerDeprecated({
            source: "imported-features",
            layerId: "imported-reservoirs",
            symbology,
          }),
        ]),
    ...tankLayers({ sources: ["icons"] }),
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
  ].filter((l) => !!l);
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

export function CIRCLE_PAINT(symbology: ISymbology): mapboxgl.CirclePaint {
  return {
    "circle-opacity": [
      "case",
      ["boolean", ["feature-state", "hidden"], false],
      0,
      asNumberExpression({
        symbology,
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
        symbology,
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
  symbology: ISymbology,
  exp = false,
): mapboxgl.FillPaint {
  return {
    "fill-opacity": [
      "case",
      ["boolean", ["feature-state", "hidden"], false],
      0,
      asNumberExpression({
        symbology,
        part: "fill-opacity",
        defaultValue:
          typeof symbology.defaultOpacity === "number"
            ? symbology.defaultOpacity
            : 0.3,
      }),
    ],
    "fill-color": handleSelected(
      asColorExpression({ symbology, part: "fill" }),
      exp,
      LINE_COLORS_SELECTED,
    ),
  };
}

export function LINE_PAINT(
  symbology: ISymbology,
  exp = false,
): mapboxgl.LinePaint {
  return {
    "line-opacity": [
      "case",
      ["boolean", ["feature-state", "hidden"], false],
      0,
      asNumberExpression({
        symbology,
        part: "stroke-opacity",
        defaultValue: 1,
      }),
    ],
    "line-width": asNumberExpression({
      symbology,
      part: "stroke-width",
      defaultValue: 4,
    }),
    "line-color": handleSelected(
      asColorExpression({ symbology, part: "stroke" }),
      exp,
      LINE_COLORS_SELECTED,
    ),
  };
}
