import { FillLayer, LineLayer } from "mapbox-gl";
import { DataSource } from "../data-source";

export const zoneFillLayer = ({
  source,
}: {
  source: DataSource;
}): FillLayer => ({
  id: "zones-fill",
  type: "fill",
  source,
  paint: {
    "fill-color": "#93c5fd",
    "fill-opacity": 0.2,
  },
});

export const zoneOutlineLayer = ({
  source,
}: {
  source: DataSource;
}): LineLayer => ({
  id: "zones-outline",
  type: "line",
  source,
  paint: {
    "line-color": "#678ab1",
    "line-width": 1.5,
    "line-opacity": 0.6,
  },
});
