import { CircleLayer, LineLayer, SymbolLayer } from "mapbox-gl";
import { DataSource } from "../data-source";
import { colors } from "src/lib/constants";
import { strokeColorFor } from "src/lib/color";
import { junctionCircleSizes } from "./junctions";

const COLOR_HIGHLIGHT_DEFAULT = colors.cyan600;
const COLOR_HIGHLIGHT_CONTRAST = strokeColorFor(COLOR_HIGHLIGHT_DEFAULT);
const COLOR_HIGHLIGHT_LIGHT = colors.cyan300;
const COLOR_HIGHLIGHT_LIGHTER = colors.cyan100;

export const highlightsMarkerHaloLayer = ({
  source,
}: {
  source: DataSource;
}) => {
  return {
    id: "highlights-marker-halo",
    type: "circle",
    source,
    layout: {},
    filter: ["all", ["==", "$type", "Point"], ["has", "marker"]],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 8, 20, 24],
      "circle-color": colors.cyan300,
      "circle-opacity": 0.7,
      "circle-blur": ["interpolate", ["linear"], ["zoom"], 12, 0, 20, 0.8],
    },
    minzoom: 10,
  } as CircleLayer;
};

export const highlightsMarkerLayer = ({ source }: { source: DataSource }) => {
  return {
    id: "highlights-marker",
    type: "circle",
    source,
    layout: {},
    filter: ["all", ["==", "$type", "Point"], ["has", "marker"]],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 5, 20, 8],
      "circle-color": colors.cyan600,
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 2,
    },
    minzoom: 10,
  } as CircleLayer;
};

export const highlightsPipesLayer = ({
  source,
}: {
  source: DataSource;
}): LineLayer => {
  return {
    id: "highlights-pipes",
    type: "line",
    source,
    filter: ["==", "type", "pipe"],
    paint: {
      "line-opacity": 1,
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        12,
        ["case", ["==", ["get", "status"], "closed"], 0.5, 1],
        16,
        ["case", ["==", ["get", "status"], "closed"], 4, 5],
      ],
      "line-color": [
        "case",
        ["==", ["get", "isActive"], false],
        COLOR_HIGHLIGHT_LIGHT,
        COLOR_HIGHLIGHT_DEFAULT,
      ],
      "line-dasharray": [
        "case",
        ["==", ["get", "status"], "closed"],
        ["literal", [2, 1]],
        ["literal", [1, 0]],
      ],
    },
  };
};

export const highlightsPumpLinesLayer = ({
  source,
}: {
  source: DataSource;
}): LineLayer => {
  return {
    id: "highlights-pump-lines",
    type: "line",
    source,
    filter: ["==", "type", "pump"],
    paint: {
      "line-opacity": 1,
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        12,
        ["case", ["==", ["get", "status"], "off"], 0.5, 1],
        16,
        ["case", ["==", ["get", "status"], "off"], 2, 3],
      ],
      "line-color": [
        "case",
        ["==", ["get", "isActive"], false],
        COLOR_HIGHLIGHT_LIGHT,
        COLOR_HIGHLIGHT_DEFAULT,
      ],
      "line-dasharray": [
        "case",
        ["==", ["get", "status"], "off"],
        ["literal", [2, 1]],
        ["literal", [1, 0]],
      ],
    },
  };
};

export const highlightsValveLinesLayer = ({
  source,
}: {
  source: DataSource;
}): LineLayer => {
  return {
    id: "highlights-valve-lines",
    type: "line",
    source,
    filter: ["==", "type", "valve"],
    paint: {
      "line-opacity": 1,
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        12,
        ["case", ["==", ["get", "status"], "closed"], 0.5, 1],
        16,
        ["case", ["==", ["get", "status"], "closed"], 2, 3],
      ],
      "line-color": [
        "case",
        ["==", ["get", "isActive"], false],
        COLOR_HIGHLIGHT_LIGHT,
        COLOR_HIGHLIGHT_DEFAULT,
      ],
      "line-dasharray": [
        "case",
        ["==", ["get", "status"], "closed"],
        ["literal", [2, 1]],
        ["literal", [1, 0]],
      ],
    },
  };
};

export const highlightsJunctionsLayer = ({
  source,
}: {
  source: DataSource;
}): CircleLayer => {
  return {
    id: "highlights-junctions",
    type: "circle",
    source,
    filter: ["==", ["get", "type"], "junction"],
    paint: {
      "circle-opacity": 1,
      "circle-stroke-color": [
        "case",
        ["==", ["get", "isActive"], false],
        COLOR_HIGHLIGHT_LIGHT,
        COLOR_HIGHLIGHT_CONTRAST,
      ],
      "circle-stroke-opacity": 1,
      "circle-color": [
        "case",
        ["==", ["get", "isActive"], false],
        COLOR_HIGHLIGHT_LIGHTER,
        COLOR_HIGHLIGHT_DEFAULT,
      ],
      ...junctionCircleSizes(),
    },
    minzoom: 13,
  };
};

export const highlightsIconsLayer = ({
  source,
}: {
  source: DataSource;
}): SymbolLayer => {
  return {
    id: "highlights-icons",
    type: "symbol",
    source,
    layout: {
      "icon-image": [
        "case",
        ["==", ["get", "isActive"], false],
        ["concat", ["get", "type"], "-disabled-highlighted"],
        ["concat", ["get", "type"], "-highlighted"],
      ],
      "icon-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        13,
        ["match", ["get", "type"], "reservoir", 0.2, 0.2],
        20,
        ["match", ["get", "type"], "reservoir", 0.5, 0.4],
      ],
      "icon-allow-overlap": true,
    },
    filter: [
      "all",
      ["has", "icon"],
      ["any", ["==", "type", "tank"], ["==", "type", "reservoir"]],
    ],
    paint: {
      "icon-opacity": 1,
    },
  };
};

export const highlightsIconsHaloLayer = ({
  source,
}: {
  source: DataSource;
}): CircleLayer => {
  return {
    id: "highlights-icons-halo",
    type: "circle",
    source,
    layout: {},
    filter: [
      "all",
      ["==", "$type", "Point"],
      ["any", ["==", "type", "pump"], ["==", "type", "valve"]],
    ],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 8, 20, 22],
      "circle-color": [
        "case",
        ["==", ["get", "isActive"], false],
        COLOR_HIGHLIGHT_LIGHT,
        COLOR_HIGHLIGHT_DEFAULT,
      ],
      "circle-opacity": 0.8,
      "circle-blur": ["interpolate", ["linear"], ["zoom"], 12, 0, 20, 0.8],
    },
  };
};
