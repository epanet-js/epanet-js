import { isFeatureOn } from "src/infra/feature-flags";
import { env } from "src/lib/env_client";
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
>;

const LAYERS: Record<string, LayerConfigTemplate> = isFeatureOn("FLAG_LAYERS")
  ? {
      MONOCHROME: {
        name: "Monochrome",
        url: "mapbox://styles/mapbox/light-v10",
        ...defaults,
        isBasemap: true,
      },
      SATELLITE: {
        name: "Satellite",
        url: "mapbox://styles/mapbox/satellite-streets-v12",
        ...defaults,
        opacity: 0.65,
        isBasemap: true,
      },
      OUTDOORS: {
        name: "Outdoors",
        url: "mapbox://styles/mapbox/outdoors-v12",
        ...defaults,
        opacity: 0.65,
        isBasemap: true,
      },
      STREETS: {
        name: "Streets",
        url: "mapbox://styles/mapbox/navigation-guidance-day-v4",
        ...defaults,
        isBasemap: true,
      },
    }
  : {
      MONOCHROME: {
        name: "Monochrome",
        url: "mapbox://styles/mapbox/light-v10",
        ...defaults,
        isBasemap: true,
      },
      DARK: {
        name: "Dark",
        url: "mapbox://styles/mapbox/dark-v10",
        ...defaults,
        isBasemap: true,
      },
      SATELLITE: {
        name: "Satellite",
        url: "mapbox://styles/mapbox/satellite-streets-v12",
        ...defaults,
        opacity: 0.65,
        isBasemap: true,
      },
      STREETS: {
        name: "Streets",
        url: "mapbox://styles/mapbox/navigation-guidance-day-v4",
        ...defaults,
        isBasemap: true,
      },
    };

export const DEFAULT_LAYER = LAYERS.MONOCHROME;

export default LAYERS;
