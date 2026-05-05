import { CircleLayer, LineLayer, SymbolLayer } from "mapbox-gl";
import { DataSource } from "../data-source";
import { colors } from "src/lib/constants";

export const highlightsPathHaloLayer = ({
  source,
}: {
  source: DataSource;
}): LineLayer => {
  return {
    id: "highlights-path-halo",
    type: "line",
    source,
    filter: ["all", ["==", "$type", "LineString"], ["has", "halo"]],
    paint: {
      "line-opacity": 0.7,
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 6, 20, 22],
      "line-color": colors.indigo300,
      "line-blur": ["interpolate", ["linear"], ["zoom"], 12, 0, 20, 8],
    },
  };
};

export const highlightsMarkerLayer = ({
  source,
}: {
  source: DataSource;
}): CircleLayer => {
  return {
    id: "highlights-marker",
    type: "circle",
    source,
    filter: [
      "all",
      ["==", "$type", "Point"],
      ["has", "marker"],
      ["!has", "icon"],
      ["!has", "halo"],
    ],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 5, 20, 8],
      "circle-color": colors.indigo600,
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 2,
    },
    minzoom: 10,
  };
};

export const highlightsMarkerHaloLayer = ({
  source,
}: {
  source: DataSource;
}): CircleLayer => {
  return {
    id: "highlights-marker-halo",
    type: "circle",
    source,
    filter: [
      "all",
      ["==", "$type", "Point"],
      ["has", "marker"],
      ["has", "halo"],
    ],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 8, 20, 24],
      "circle-color": colors.indigo300,
      "circle-opacity": 0.7,
      "circle-blur": ["interpolate", ["linear"], ["zoom"], 12, 0, 20, 0.8],
    },
    minzoom: 10,
  };
};

export const highlightsMarkerIconLayer = ({
  source,
}: {
  source: DataSource;
}): SymbolLayer => {
  return {
    id: "highlights-marker-icon",
    type: "symbol",
    source,
    layout: {
      "icon-image": ["get", "icon"],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 13, 0.2, 20, 0.4],
      "icon-allow-overlap": true,
    },
    filter: [
      "all",
      ["==", "$type", "Point"],
      ["has", "marker"],
      ["has", "icon"],
    ],
    paint: {
      "icon-opacity": 1,
    },
  };
};
