import { CircleLayer, LineLayer, SymbolLayer } from "mapbox-gl";
import { DataSource } from "../data-source";
import { colors } from "src/lib/constants";
import { junctionCircleSizes } from "./junctions";

export const ephemeralHaloLayer = ({ source }: { source: DataSource }) => {
  return {
    id: "ephemeral-halo",
    type: "circle",
    source,
    layout: {},
    filter: ["all", ["==", "$type", "Point"], ["has", "halo"]],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 8, 20, 24],
      "circle-color": colors.indigo300,
      "circle-opacity": 0.7,
      "circle-blur": ["interpolate", ["linear"], ["zoom"], 12, 0, 20, 0.8],
    },
    minzoom: 10,
  } as CircleLayer;
};

export const ephemeralJunctionHighlightLayers = ({
  source,
}: {
  source: DataSource;
}) => {
  return {
    id: "ephemeral-junction-highlight",
    type: "circle",
    source,
    layout: {},
    filter: ["all", ["==", "$type", "Point"], ["!has", "icon"]],
    paint: {
      "circle-color": colors.indigo800,
      "circle-stroke-color": colors.indigo200,
      ...junctionCircleSizes(),
    },
    minzoom: 10,
  } as CircleLayer;
};

export const ephemeralIconHighlightLayers = ({
  source,
}: {
  source: DataSource;
}) => {
  return {
    id: "ephemeral-icons-highlight",
    type: "symbol",
    source,
    layout: {
      "symbol-placement": "point",
      "icon-image": ["get", "icon"],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 13, 0.2, 20, 0.4],
      "icon-allow-overlap": true,
    },
    filter: ["all", ["==", "$type", "Point"], ["has", "icon"]],
    paint: {
      "icon-opacity": 1,
    },
  } as SymbolLayer;
};

export const ephemeralDraftLineLayer = ({
  source,
}: {
  source: DataSource;
}): LineLayer => {
  return {
    id: "ephemeral-draft-line",
    type: "line",
    source,
    filter: ["all", ["==", "$type", "LineString"], ["has", "draft"]],
    paint: {
      "line-opacity": 1,
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 16, 4],
      "line-color": colors.indigo500,
      "line-dasharray": [1, 1],
    },
  };
};

export const ephemeralPipeHighlightLayer = ({
  source,
}: {
  source: DataSource;
}): LineLayer => {
  return {
    id: "ephemeral-pipe-highlight",
    type: "line",
    source,
    filter: ["all", ["==", "$type", "LineString"], ["has", "pipeHighlight"]],
    paint: {
      "line-opacity": 1,
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1, 16, 5],
      "line-color": colors.indigo500,
    },
  };
};

export const ephemeralVerticesLayer = ({ source }: { source: DataSource }) => {
  return {
    id: "ephemeral-vertices",
    type: "symbol",
    source,
    layout: {
      "symbol-placement": "point",
      "icon-image": [
        "case",
        ["==", ["get", "type"], "vertex-candidate"],
        "vertex-square-candidate",
        ["==", ["get", "selected"], true],
        "vertex-square-selected",
        "vertex-square-default",
      ],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 12, 0.1, 16, 0.15],
      "icon-allow-overlap": true,
    },
    filter: [
      "in",
      ["get", "type"],
      ["literal", ["vertex", "vertex-candidate"]],
    ],
    paint: {
      "icon-opacity": 1,
    },
    minzoom: 10,
  } as SymbolLayer;
};

export const ephemeralShadowLineLayer = ({
  source,
}: {
  source: DataSource;
}): LineLayer => {
  return {
    id: "ephemeral-shadow-line",
    type: "line",
    source,
    filter: ["all", ["==", "$type", "LineString"], ["has", "shadowLine"]],
    paint: {
      "line-opacity": 0.4,
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 16, 3],
      "line-color": colors.gray500,
    },
  };
};
