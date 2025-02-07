import { env } from "src/lib/env_client";
import { ILayerConfig } from "src/types";

const defaults = {
  type: "MAPBOX",
  token: env.NEXT_PUBLIC_MAPBOX_TOKEN,
  opacity: 1,
} as const;

export type LayerConfigTemplate = Pick<
  ILayerConfig,
  "name" | "url" | "type" | "token" | "opacity"
>;

const LAYERS: Record<string, LayerConfigTemplate> = {
  MONOCHROME: {
    name: "Monochrome",
    url: "mapbox://styles/mapbox/light-v10",
    ...defaults,
  },
  DARK: {
    name: "Dark",
    url: "mapbox://styles/mapbox/dark-v10",
    ...defaults,
  },
  SATELLITE: {
    name: "Satellite",
    url: "mapbox://styles/mapbox/satellite-streets-v12",
    ...defaults,
    opacity: 0.65,
  },
  STREETS: {
    name: "Streets",
    url: "mapbox://styles/mapbox/navigation-guidance-day-v4",
    ...defaults,
  },
};

export const DEFAULT_LAYER = LAYERS.MONOCHROME;

export default LAYERS;
