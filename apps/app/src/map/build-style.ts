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
    layers: [
      {
        id: "background",
        type: "background",
        paint: {
          "background-color": "#F5F5F5",
        },
      },
    ],
  };
  return style;
}

const emptyGeoJSONSource = {
  type: "geojson",
  data: emptyFeatureCollection,
  buffer: 4,
  tolerance: 0,
  maxzoom: 22,
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
      case "GEOJSON": {
        // GIS data lives outside buildBaseStyle — sources are added after
        // style.load via addGisLayersToMap in state-updates.ts.
        break;
      }
    }
  }

  defineEmptySources(style);

  return style;
}

export function defineEmptySources(style: Style) {
  style.sources["main-features"] = emptyGeoJSONSource;
  style.sources["delta-features"] = emptyGeoJSONSource;
  style.sources["icons"] = emptyGeoJSONSource;
  style.sources["selected-features"] = emptyGeoJSONSource;
  style.sources["ephemeral"] = emptyGeoJSONSource;
  style.sources["map-overlay"] = emptyGeoJSONSource;
  style.sources["highlights"] = emptyGeoJSONSource;
  style.sources["grid"] = emptyGeoJSONSource;
  style.sources["zones"] = emptyGeoJSONSource;
}

export function defineFacetedSources(style: Style) {
  style.sources["delta-icons"] = emptyGeoJSONSource;
}

import type { PreviewProperty } from "src/state/map-symbology";
import type { ISymbology } from "src/types";
import { reservoirLayers, pipesLayer, junctionsLayer } from "src/map/layers";
import {
  pipeArrows,
  checkValveIcons,
  facetedPipesLayer,
  facetedPipeArrows,
} from "src/map/layers/pipes";
import { pumpIcons, pumpLines, facetedPumpLines } from "src/map/layers/pumps";
import {
  valveIcons,
  valveLines,
  facetedValveLines,
} from "src/map/layers/valves";
import { facetedJunctionsLayer } from "src/map/layers/junctions";
import { facetedReservoirLayers } from "src/map/layers/reservoirs";
import { linkLabelsLayer } from "src/map/layers/link-labels";
import { nodeLabelsLayer } from "src/map/layers/node-labels";
import { tankLayers, facetedTankLayers } from "src/map/layers/tank";
import {
  mapOverlayFillLayer,
  mapOverlayOutlineLayer,
  mapOverlayLabelLayer,
} from "src/map/layers/map-overlay";
import {
  zoneFillLayer,
  zoneOutlineLayer,
  zoneLabelsLayer,
} from "src/map/layers/zones";
import {
  ephemeralDraftLineLayer,
  ephemeralDraftPathLineLayer,
  ephemeralIconHighlightLayers,
  ephemeralJunctionHighlightLayers,
  ephemeralHaloLayer,
  ephemeralPipeHighlightLayer,
  ephemeralShadowLineLayer,
  ephemeralSelectionFillLayer,
  ephemeralSelectionOutlineLayer,
} from "src/map/layers/ephemeral-state";
import {
  highlightsMarkerHaloLayer,
  highlightsMarkerIconLayer,
  highlightsMarkerLayer,
  highlightsPathHaloLayer,
} from "src/map/layers/highlights";
import { gridMinorLayer, gridMajorLayer } from "src/map/layers/grid";
import {
  selectedPipesLayer,
  selectedPumpLinesLayer,
  selectedValveLinesLayer,
  selectedPipeArrowsLayer,
  selectedJunctionsLayer,
  selectedIconsHaloLayer,
  selectedIconsLayer,
} from "src/map/layers/selection";
import type * as mapboxgl from "mapbox-gl";
import type { NodeDefaults, LinkDefaults } from "src/map/symbology";

const DELTA_FEATURES_POINT_LABEL_LAYER_NAME = "delta-features-point-label";
const DELTA_FEATURES_LINE_LABEL_LAYER_NAME = "delta-features-line-label";
const DELTA_FEATURES_LINE_LAYER_NAME = "delta-features-line";
const DELTA_FEATURES_POINT_LAYER_NAME = "delta-features-symbol";

const CONTENT_LAYER_FILTERS: {
  [key: string]: mapboxgl.Layer["filter"];
} = {
  [DELTA_FEATURES_LINE_LAYER_NAME]: [
    "any",
    ["==", "$type", "LineString"],
    ["==", "$type", "Polygon"],
  ],
  [DELTA_FEATURES_POINT_LAYER_NAME]: ["all", ["==", "$type", "Point"]],
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

type MakeLayersParams = {
  symbology: ISymbology;
  previewProperty: PreviewProperty;
  nodeDefaults: NodeDefaults;
  linkDefaults: LinkDefaults;
};

const previewLabelLayers = (
  symbology: ISymbology,
  previewProperty: PreviewProperty,
): mapboxgl.AnyLayer[] =>
  typeof previewProperty === "string"
    ? [
        {
          id: DELTA_FEATURES_POINT_LABEL_LAYER_NAME,
          type: "symbol",
          source: "delta-features",
          paint: LABEL_PAINT(symbology, previewProperty),
          layout: LABEL_LAYOUT(previewProperty, "point"),
          filter: addPreviewFilter(
            CONTENT_LAYER_FILTERS[DELTA_FEATURES_POINT_LAYER_NAME],
            previewProperty,
          ),
        } as mapboxgl.AnyLayer,
        {
          id: DELTA_FEATURES_LINE_LABEL_LAYER_NAME,
          type: "symbol",
          source: "delta-features",
          paint: LABEL_PAINT(symbology, previewProperty),
          layout: LABEL_LAYOUT(previewProperty, "line"),
          filter: addPreviewFilter(
            CONTENT_LAYER_FILTERS[DELTA_FEATURES_LINE_LAYER_NAME],
            previewProperty,
          ),
        } as mapboxgl.AnyLayer,
      ]
    : [];

export function makeLayers({
  symbology,
  previewProperty,
  nodeDefaults,
  linkDefaults,
}: MakeLayersParams): mapboxgl.AnyLayer[] {
  return [
    gridMinorLayer(),
    gridMajorLayer(),
    zoneFillLayer({ source: "zones" }),
    zoneOutlineLayer({ source: "zones" }),
    zoneLabelsLayer({ source: "zones" }),
    mapOverlayFillLayer({ source: "map-overlay" }),
    mapOverlayOutlineLayer({ source: "map-overlay" }),
    mapOverlayLabelLayer({ source: "map-overlay" }),
    ephemeralHaloLayer({ source: "ephemeral" }),
    ephemeralDraftPathLineLayer({ source: "ephemeral" }),
    highlightsPathHaloLayer({ source: "highlights" }),
    highlightsMarkerHaloLayer({ source: "highlights" }),
    pipesLayer({
      source: "main-features",
      layerId: "main-features-pipes",
      symbology,
      linkDefaults,
    }),
    pipesLayer({
      source: "delta-features",
      layerId: "delta-features-pipes",
      symbology,
      linkDefaults,
    }),
    selectedPipesLayer({
      source: "selected-features",
      layerId: "selected-pipes",
    }),
    pumpLines({
      source: "main-features",
      layerId: "main-features-pump-lines",
      symbology,
    }),
    pumpLines({
      source: "delta-features",
      layerId: "delta-features-pump-lines",
      symbology,
    }),
    selectedPumpLinesLayer({
      source: "selected-features",
      layerId: "selected-pump-lines",
    }),
    valveLines({
      source: "main-features",
      layerId: "main-features-valve-lines",
      symbology,
    }),
    valveLines({
      source: "delta-features",
      layerId: "delta-features-valve-lines",
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
      source: "main-features",
      layerId: "main-features-pipe-arrows",
      linkDefaults,
    }),
    pipeArrows({
      source: "delta-features",
      layerId: "delta-features-pipe-arrows",
      linkDefaults,
    }),
    selectedPipeArrowsLayer({
      source: "selected-features",
      layerId: "selected-pipe-arrows",
    }),
    junctionsLayer({
      source: "main-features",
      layerId: "main-features-junctions",
      symbology,
      nodeDefaults,
    }),
    junctionsLayer({
      source: "delta-features",
      layerId: "delta-features-junctions",
      symbology,
      nodeDefaults,
    }),
    selectedJunctionsLayer({
      source: "selected-features",
      layerId: "selected-junctions",
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
    highlightsMarkerIconLayer({ source: "highlights" }),
    highlightsMarkerLayer({ source: "highlights" }),
    ...linkLabelsLayer({
      sources: ["main-features", "delta-features"],
    }),
    ...nodeLabelsLayer({
      sources: ["main-features", "delta-features"],
    }),
    ...previewLabelLayers(symbology, previewProperty),
    ephemeralSelectionFillLayer({ source: "ephemeral" }),
    ephemeralSelectionOutlineLayer({ source: "ephemeral" }),
  ].filter((l) => !!l);
}

// Parallel to makeLayers for the faceted path (FLAG_MAP_FACETED_SOURCES). Differences:
// (1) selection is merged into the base delta layers via a `selected` case on
//     color/sprite (`selectable: true`) instead of the `selected-*` overlay layers —
//     selected assets ride in `delta-features`/`delta-icons`, hidden in main;
// (2) the pump/valve selection halo is additive geometry, so it stays as one filtered
//     layer on `delta-icons`;
// (3) an extra `delta-icons` facet mirrors the main `icons` layers.
// Kept as a separate function (not a flag on makeLayers) so the two layer sets evolve
// independently; collapse into makeLayers when the pre-facet path is removed.
export function makeFacetedLayers({
  symbology,
  previewProperty,
  nodeDefaults,
  linkDefaults,
}: MakeLayersParams): mapboxgl.AnyLayer[] {
  return [
    gridMinorLayer(),
    gridMajorLayer(),
    zoneFillLayer({ source: "zones" }),
    zoneOutlineLayer({ source: "zones" }),
    zoneLabelsLayer({ source: "zones" }),
    mapOverlayFillLayer({ source: "map-overlay" }),
    mapOverlayOutlineLayer({ source: "map-overlay" }),
    mapOverlayLabelLayer({ source: "map-overlay" }),
    ephemeralHaloLayer({ source: "ephemeral" }),
    ephemeralDraftPathLineLayer({ source: "ephemeral" }),
    highlightsPathHaloLayer({ source: "highlights" }),
    highlightsMarkerHaloLayer({ source: "highlights" }),
    // Both main and delta feature layers carry the faceted expressions: selection is
    // merged into the `selected` prop on both sources, so a selected asset renders
    // highlighted whether it is in main (e.g. coalesced) or delta (the live-set).
    facetedPipesLayer({
      source: "main-features",
      layerId: "main-features-pipes",
      symbology,
      linkDefaults,
    }),
    facetedPipesLayer({
      source: "delta-features",
      layerId: "delta-features-pipes",
      symbology,
      linkDefaults,
    }),
    facetedPumpLines({
      source: "main-features",
      layerId: "main-features-pump-lines",
      symbology,
    }),
    facetedPumpLines({
      source: "delta-features",
      layerId: "delta-features-pump-lines",
      symbology,
    }),
    facetedValveLines({
      source: "main-features",
      layerId: "main-features-valve-lines",
      symbology,
    }),
    facetedValveLines({
      source: "delta-features",
      layerId: "delta-features-valve-lines",
      symbology,
    }),
    ephemeralShadowLineLayer({ source: "ephemeral" }),
    ephemeralDraftLineLayer({ source: "ephemeral" }),
    ephemeralPipeHighlightLayer({ source: "ephemeral" }),
    facetedPipeArrows({
      source: "main-features",
      layerId: "main-features-pipe-arrows",
      linkDefaults,
    }),
    facetedPipeArrows({
      source: "delta-features",
      layerId: "delta-features-pipe-arrows",
      linkDefaults,
    }),
    facetedJunctionsLayer({
      source: "main-features",
      layerId: "main-features-junctions",
      symbology,
      nodeDefaults,
    }),
    facetedJunctionsLayer({
      source: "delta-features",
      layerId: "delta-features-junctions",
      symbology,
      nodeDefaults,
    }),
    // Main icon facet (halo below the icons it haloes; tank/reservoir use the
    // faceted selected sprite).
    selectedIconsHaloLayer({
      source: "icons",
      layerId: "selected-icons-halo",
      filterSelected: true,
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
    ...facetedReservoirLayers({ sources: ["icons"] }),
    ...facetedTankLayers({ sources: ["icons"] }),
    // Delta icon facet: mirrors the main `icons` layers on `delta-icons`.
    selectedIconsHaloLayer({
      source: "delta-icons",
      layerId: "delta-selected-icons-halo",
      filterSelected: true,
    }),
    ...valveIcons({
      source: "delta-icons",
      layerId: "delta-icons-valve-icons",
    }),
    checkValveIcons({
      source: "delta-icons",
      layerId: "delta-icons-check-valve-icons",
    }),
    pumpIcons({
      source: "delta-icons",
      layerId: "delta-icons-pump-icons",
      symbology,
    }),
    ...facetedReservoirLayers({ sources: ["delta-icons"] }),
    ...facetedTankLayers({ sources: ["delta-icons"] }),
    ephemeralJunctionHighlightLayers({ source: "ephemeral" }),
    ephemeralIconHighlightLayers({ source: "ephemeral" }),
    highlightsMarkerIconLayer({ source: "highlights" }),
    highlightsMarkerLayer({ source: "highlights" }),
    ...linkLabelsLayer({
      sources: ["main-features", "delta-features"],
    }),
    ...nodeLabelsLayer({
      sources: ["main-features", "delta-features"],
    }),
    ...previewLabelLayers(symbology, previewProperty),
    ephemeralSelectionFillLayer({ source: "ephemeral" }),
    ephemeralSelectionOutlineLayer({ source: "ephemeral" }),
  ].filter((l) => !!l);
}
