import { env } from "src/lib/env-client";
import { ILayerConfig } from "src/types";

const defaults = {
  type: "MAPBOX",
  token: env.NEXT_PUBLIC_MAPBOX_TOKEN,
  opacity: 1,
  sourceMaxZoom: {},
  isBasemap: false,
} as const;

export type LayerConfigTemplate = Pick<
  ILayerConfig,
  "name" | "url" | "type" | "token" | "opacity" | "sourceMaxZoom" | "isBasemap"
> & {
  thumbnailClass: string;
};

export const basemaps = {
  monochrome: {
    name: "Monochrome",
    url: "mapbox://styles/mapbox/light-v10",
    thumbnailClass: "bg-thumbnail-monochrome",
    ...defaults,
    isBasemap: true,
  },
  satellite: {
    name: "Satellite",
    url: "mapbox://styles/mapbox/satellite-streets-v12",
    thumbnailClass: "bg-thumbnail-satellite",
    ...defaults,
    opacity: 0.65,
    isBasemap: true,
  },
  outdoors: {
    name: "Outdoors",
    url: "mapbox://styles/mapbox/outdoors-v12",
    thumbnailClass: "bg-thumbnail-outdoors",
    ...defaults,
    opacity: 0.65,
    isBasemap: true,
  },
  streets: {
    name: "Streets",
    url: "mapbox://styles/mapbox/navigation-guidance-day-v4",
    thumbnailClass: "bg-thumbnail-streets",
    ...defaults,
    isBasemap: true,
  },
} as const;

export const defaultBasemap = basemaps.monochrome;
