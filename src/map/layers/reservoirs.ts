import { SymbolLayer } from "mapbox-gl";
import { LayerId } from "./layer";

export const reservoirsLayer = ({
  source,
  layerId,
}: {
  source: string;
  layerId: LayerId;
}): SymbolLayer => {
  return {
    id: layerId,
    type: "symbol",
    source,
    layout: {
      "symbol-placement": "point",
      "icon-image": "reservoir",
      "icon-size": 0.6,
      "icon-allow-overlap": true,
    },
    filter: ["==", ["get", "type"], "reservoir"],
    paint: {
      "icon-opacity": [
        "case",
        [
          "all",
          ["!=", ["feature-state", "selected"], "true"],
          ["!=", ["feature-state", "hidden"], true],
        ],
        1,
        0,
      ],
    },
  };
};

export const reservoirsSelectedLayer = ({
  source,
  layerId,
}: {
  source: string;
  layerId: LayerId;
}): SymbolLayer => {
  return {
    id: layerId,
    type: "symbol",
    source,
    layout: {
      "symbol-placement": "point",
      "icon-image": "reservoir-selected",
      "icon-size": 0.6,
      "icon-allow-overlap": true,
    },
    filter: ["==", ["get", "type"], "reservoir"],
    paint: {
      "icon-opacity": [
        "case",
        [
          "all",
          ["==", ["feature-state", "selected"], "true"],
          ["!=", ["feature-state", "hidden"], true],
        ],
        1,
        0,
      ],
    },
  };
};
