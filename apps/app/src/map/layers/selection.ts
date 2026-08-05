import { CircleLayer } from "mapbox-gl";
import { DataSource } from "../data-source";
import { LayerId } from "./layer";
import { colors } from "src/lib/constants";

const COLOR_SELECTED_DEFAULT = colors.fuchsia500;
const COLOR_SELECTED_LIGHT = colors.fuchsia300;

const withSelected = (filter: any, filterSelected?: boolean): any =>
  filterSelected ? ["all", filter, ["==", ["get", "selected"], true]] : filter;

export const selectedIconsHaloLayer = ({
  source,
  layerId,
  filterSelected,
}: {
  source: DataSource;
  layerId: LayerId;
  // The halo is the one selection layer that stays separate (it is additive geometry,
  // not a color/sprite change), so it filters the icon source on the `selected` prop.
  filterSelected?: boolean;
}): CircleLayer => {
  return {
    id: layerId,
    type: "circle",
    source,
    layout: {},
    filter: withSelected(
      [
        "all",
        ["==", ["geometry-type"], "Point"],
        [
          "any",
          ["==", ["get", "type"], "pump"],
          ["==", ["get", "type"], "valve"],
        ],
      ],
      filterSelected,
    ),
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 8, 20, 22],
      "circle-color": [
        "case",
        ["==", ["get", "isActive"], false],
        COLOR_SELECTED_LIGHT,
        COLOR_SELECTED_DEFAULT,
      ],
      "circle-opacity": [
        "case",
        ["boolean", ["feature-state", "hidden"], false],
        0,
        0.8,
      ],
      "circle-blur": ["interpolate", ["linear"], ["zoom"], 12, 0, 20, 0.8],
    },
  };
};
