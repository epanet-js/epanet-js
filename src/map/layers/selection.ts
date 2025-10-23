import { CircleLayer, LineLayer, SymbolLayer } from "mapbox-gl";
import { LINE_COLORS_SELECTED, POINT_COLORS_SELECTED } from "src/lib/constants";
import { DataSource } from "../data-source";
import { LayerId } from "./layer";
import { strokeColorFor } from "src/lib/color";
import { junctionCircleSizes } from "./junctions";

export const selectedPipesLayer = ({
  source,
  layerId,
}: {
  source: DataSource;
  layerId: LayerId;
}): LineLayer => {
  return {
    id: layerId,
    type: "line",
    source,
    filter: ["==", "type", "pipe"],
    paint: {
      "line-opacity": 1,
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1, 16, 5],
      "line-color": LINE_COLORS_SELECTED,
      "line-dasharray": [
        "case",
        ["==", ["get", "status"], "closed"],
        ["literal", [2, 1]],
        ["literal", [1, 0]],
      ],
    },
  };
};

export const selectedPumpLinesLayer = ({
  source,
  layerId,
}: {
  source: DataSource;
  layerId: LayerId;
}): LineLayer => {
  return {
    id: layerId,
    type: "line",
    source,
    filter: ["==", "type", "pump"],
    paint: {
      "line-opacity": 1,
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1, 16, 3],
      "line-color": LINE_COLORS_SELECTED,
      "line-dasharray": [
        "case",
        ["==", ["get", "status"], "off"],
        ["literal", [2, 1]],
        ["literal", [1, 0]],
      ],
    },
  };
};

export const selectedValveLinesLayer = ({
  source,
  layerId,
}: {
  source: DataSource;
  layerId: LayerId;
}): LineLayer => {
  return {
    id: layerId,
    type: "line",
    source,
    filter: ["==", "type", "valve"],
    paint: {
      "line-opacity": 1,
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1, 16, 3],
      "line-color": LINE_COLORS_SELECTED,
      "line-dasharray": [
        "case",
        ["==", ["get", "status"], "closed"],
        ["literal", [2, 1]],
        ["literal", [1, 0]],
      ],
    },
  };
};

export const selectedJunctionsLayer = ({
  source,
  layerId,
}: {
  source: DataSource;
  layerId: LayerId;
}): CircleLayer => {
  return {
    id: layerId,
    type: "circle",
    source,
    filter: ["==", ["get", "type"], "junction"],
    paint: {
      "circle-opacity": 1,
      "circle-stroke-color": strokeColorFor(POINT_COLORS_SELECTED),
      ...junctionCircleSizes(),
      "circle-stroke-opacity": 1,
      "circle-color": POINT_COLORS_SELECTED,
    },
    minzoom: 13,
  };
};

export const selectedIconsLayer = ({
  source,
  layerId,
}: {
  source: DataSource;
  layerId: LayerId;
}): SymbolLayer => {
  return {
    id: layerId,
    type: "symbol",
    source,
    layout: {
      "icon-image": ["concat", ["get", "type"], "-selected"],
      "icon-size": [
        "case",
        ["==", ["get", "type"], "reservoir"],
        ["interpolate", ["linear"], ["zoom"], 13, 0.2, 20, 0.5],
        ["==", ["get", "type"], "tank"],
        ["interpolate", ["linear"], ["zoom"], 13, 0.2, 20, 0.4],
        ["interpolate", ["linear"], ["zoom"], 13, 0.2, 20, 0.4],
      ],
      "icon-allow-overlap": true,
      "icon-rotation-alignment": "map",
      "icon-rotate": ["get", "rotation"],
    },
    filter: [
      "all",
      ["has", "icon"],
      [
        "in",
        ["get", "type"],
        ["literal", ["pump", "valve", "tank", "reservoir"]],
      ],
    ],
    paint: {
      "icon-opacity": 1,
    },
    minzoom: 10,
  };
};

export const selectedIconsHaloLayer = ({
  source,
  layerId,
}: {
  source: DataSource;
  layerId: LayerId;
}): CircleLayer => {
  return {
    id: layerId,
    type: "circle",
    source,
    layout: {},
    filter: [
      "all",
      ["==", "$type", "Point"],
      [
        "in",
        ["get", "type"],
        ["literal", ["pump", "valve", "tank", "reservoir"]],
      ],
    ],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 8, 20, 22],
      "circle-color": LINE_COLORS_SELECTED,
      "circle-opacity": 0.8,
      "circle-blur": ["interpolate", ["linear"], ["zoom"], 12, 0, 20, 0.8],
    },
    minzoom: 10,
  };
};
