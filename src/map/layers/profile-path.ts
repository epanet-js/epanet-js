import { CircleLayer, LineLayer } from "mapbox-gl";
import { DataSource } from "../data-source";

const COLOR_PRIMARY = "#f97316";
const COLOR_REMOVE = "#9ca3af";

export const profilePathLineLayer = (): LineLayer => ({
  id: "profile-path-line",
  type: "line",
  source: "profile-path",
  paint: {
    "line-color": COLOR_PRIMARY,
    "line-width": 5,
    "line-opacity": 1,
  },
});

export const profileHoverPathLineLayer = (): LineLayer => ({
  id: "profile-hover-path-line",
  type: "line",
  source: "profile-hover",
  paint: {
    "line-color": COLOR_PRIMARY,
    "line-width": 5,
    "line-opacity": 0.5,
  },
});

export const profileHoverRemoveLineLayer = (): LineLayer => ({
  id: "profile-hover-remove-line",
  type: "line",
  source: "profile-hover-remove",
  filter: ["==", "$type", "LineString"],
  paint: {
    "line-color": COLOR_REMOVE,
    "line-width": 5,
    "line-opacity": 1,
  },
});

export const profileHoverRemoveNodeLayer = (): CircleLayer => ({
  id: "profile-hover-remove-node",
  type: "circle",
  source: "profile-hover-remove",
  filter: ["==", "$type", "Point"],
  minzoom: 11,
  paint: {
    "circle-color": COLOR_REMOVE,
    "circle-radius": 8,
    "circle-stroke-color": COLOR_REMOVE,
    "circle-stroke-width": 2,
    "circle-opacity": 1,
  },
});

export const profilePathNodeLayer = ({
  source,
}: {
  source: DataSource;
}): CircleLayer => ({
  id: "profile-path-node",
  type: "circle",
  source,
  filter: ["all", ["==", "$type", "Point"], ["has", "profileType"]],
  minzoom: 11,
  paint: {
    "circle-color": [
      "case",
      [
        "any",
        ["==", ["get", "profileType"], "start"],
        ["==", ["get", "profileType"], "end"],
      ],
      COLOR_PRIMARY,
      "#ffffff",
    ],
    "circle-radius": ["case", ["==", ["get", "profileType"], "hover"], 10, 8],
    "circle-stroke-color": COLOR_PRIMARY,
    "circle-stroke-width": [
      "case",
      ["==", ["get", "profileType"], "hover"],
      3,
      2,
    ],
    "circle-opacity": 1,
  },
});
