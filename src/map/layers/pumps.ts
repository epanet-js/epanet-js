import { ISymbology } from "src/types";
import { DataSource } from "../data-source";
import { LayerId } from "./layer";
import { LineLayer, LinePaint, SymbolLayer } from "mapbox-gl";
import { colors } from "src/lib/constants";
import { asNumberExpression } from "src/lib/symbolization-deprecated";

export const pumpLines = ({
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
    "line-color": [
      "case",
      ["==", ["get", "isActive"], false],
      colors.zinc400,
      ["coalesce", ["get", "color"], colors.orange700],
    ],
    "line-dasharray": [
      "case",
      ["==", ["get", "status"], "off"],
      ["literal", [2, 1]],
      ["literal", [1, 0]],
    ],
  };
  return {
    id: layerId,
    type: "line",
    source,
    filter: ["==", "type", "pump"],
    paint: paint as LinePaint,
  };
};

export const pumpIcons = ({
  source,
  layerId,
  symbology,
}: {
  source: DataSource;
  layerId: LayerId;
  symbology: ISymbology;
}): SymbolLayer => {
  return {
    id: layerId,
    type: "symbol",
    source,
    layout: {
      "icon-image": [
        "case",
        ["==", ["get", "isActive"], false],
        "pump-disabled",
        ["==", ["get", "status"], "off"],
        "pump-off",
        "pump-on",
      ],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 10, 0.1, 20, 0.4],
      "icon-rotate": ["get", "rotation"],
      "icon-allow-overlap": true,
      "icon-rotation-alignment": "map",
    },
    filter: ["==", "type", "pump"],
    paint: {
      "icon-color": ["coalesce", ["get", "color"], symbology.defaultColor],
      "icon-opacity": [
        "case",
        ["boolean", ["feature-state", "hidden"], false],
        0,
        1,
      ],
    },
    minzoom: 10,
  };
};
