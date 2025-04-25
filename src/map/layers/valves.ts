import { ISymbolization } from "src/types";
import { DataSource } from "../data-source";
import { LayerId } from "./layer";
import { AnyLayer, CircleLayer, LineLayer, LinePaint } from "mapbox-gl";
import { LINE_COLORS_SELECTED, colors } from "src/lib/constants";
import { asNumberExpression } from "src/lib/symbolization";

export const valveLines = ({
  source,
  layerId,
  symbolization,
}: {
  source: DataSource;
  layerId: LayerId;
  symbolization: ISymbolization;
}): LineLayer => {
  const paint = {
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
    "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 16, 2],
    "line-color": [
      "match",
      ["feature-state", "selected"],
      "true",
      LINE_COLORS_SELECTED,
      ["coalesce", ["get", "color"], colors.orange700],
    ],
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
  layerId: LayerId;
}): AnyLayer[] => {
  return [
    {
      id: layerId + "-selected",
      type: "circle",
      source,
      layout: {},
      filter: ["all", ["==", "type", "valve"], ["==", "selected", true]],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 8, 20, 22],
        "circle-color": LINE_COLORS_SELECTED,
        "circle-opacity": 0.8,
        "circle-blur": ["interpolate", ["linear"], ["zoom"], 12, 0, 20, 0.8],
      },
      minzoom: 10,
    } as CircleLayer,
    {
      id: layerId,
      type: "symbol",
      source,
      layout: {
        "icon-image": ["get", "icon"],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 10, 0.1, 20, 0.4],
        "icon-rotate": ["get", "rotation"],
        "icon-allow-overlap": true,
        "icon-rotation-alignment": "map",
      },
      filter: ["==", "type", "valve"],
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
