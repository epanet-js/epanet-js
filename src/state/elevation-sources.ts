import { atom } from "jotai";
import type {
  ElevationSource,
  TileServerElevationSource,
} from "src/lib/elevations";

const defaultMapboxSource: TileServerElevationSource = {
  type: "tile-server",
  id: "mapbox-default",
  enabled: true,
  name: "Mapbox default data",
  tileUrlTemplate: `https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}@2x.pngraw?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`,
  tileZoom: 14,
  tileSize: 512,
  encoding: "terrain-rgb",
  elevationOffsetM: 0,
};

export const elevationSourcesAtom = atom<ElevationSource[]>([
  defaultMapboxSource,
]);

export const hoveredElevationSourceIdAtom = atom<string | null>(null);
