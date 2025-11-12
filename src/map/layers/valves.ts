import { ISymbology } from "src/types";
import { DataSource } from "../data-source";
import { LayerId } from "./layer";
import { LineLayer, LinePaint, SymbolLayer } from "mapbox-gl";
import { colors } from "src/lib/constants";
import { asNumberExpression } from "src/lib/symbolization-deprecated";

export const valveLines = ({
  source,
  layerId,
  symbology,
}: {
  source: DataSource;
  layerId: LayerId;
  symbology: ISymbology;
}): LineLayer => {
  const paint = {
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
    "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 16, 2],
    "line-color": ["coalesce", ["get", "color"], colors.orange700],
    "line-dasharray": [
      "case",
      ["==", ["get", "status"], "closed"],
      ["literal", [2, 1]],
      ["literal", [1, 0]],
    ],
  };
  return {
    id: layerId,
    type: "line",
    source,
    filter: ["==", "type", "valve"],
    paint: paint as LinePaint,
  };
};

export const valveIcons = ({
  source,
  layerId,
}: {
  source: DataSource;
  layerId: string;
}): SymbolLayer[] => {
  return [
    {
      id: layerId + "-isolation-valves",
      type: "symbol",
      source,
      layout: {
        "icon-image": ["get", "icon"],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 13, 0.1, 20, 0.4],
        "icon-rotate": ["get", "rotation"],
        "icon-allow-overlap": true,
        "icon-rotation-alignment": "map",
      },
      filter: ["all", ["==", "type", "valve"], ["==", "isControlValve", false]],
      paint: {
        "icon-opacity": [
          "case",
          ["boolean", ["feature-state", "hidden"], false],
          0,
          1,
        ],
      },
      minzoom: 13,
    },
    {
      id: layerId + "-control-valves",
      type: "symbol",
      source,
      layout: {
        "icon-image": ["get", "icon"],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 10, 0.1, 20, 0.4],
        "icon-rotate": ["get", "rotation"],
        "icon-allow-overlap": true,
        "icon-rotation-alignment": "map",
      },
      filter: ["all", ["==", "type", "valve"], ["==", "isControlValve", true]],
      paint: {
        "icon-opacity": [
          "case",
          ["boolean", ["feature-state", "hidden"], false],
          0,
          1,
        ],
      },
      minzoom: 10,
    },
  ];
};

export const valveLinesWithActiveTopology = ({
  source,
  layerId,
  symbology,
}: {
  source: DataSource;
  layerId: LayerId;
  symbology: ISymbology;
}): LineLayer => {
  const paint = {
    "line-opacity": [
      "case",
      ["boolean", ["feature-state", "hidden"], false],
      0,
      ["==", ["get", "isActive"], false],
      0.33,
      asNumberExpression({
        symbology,
        part: "stroke-opacity",
        defaultValue: 1,
      }),
    ],
    "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 16, 2],
    "line-color": ["coalesce", ["get", "color"], colors.orange700],
    "line-dasharray": [
      "case",
      ["==", ["get", "status"], "closed"],
      ["literal", [2, 1]],
      ["literal", [1, 0]],
    ],
  };
  return {
    id: layerId,
    type: "line",
    source,
    filter: ["==", "type", "valve"],
    paint: paint as LinePaint,
  };
};
