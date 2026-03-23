export type GeoTiffElevationSource = {
  type: "geotiff";
  id: string;
  enabled: boolean;
  fileName: string;
  fileSize: number;
  width: number;
  height: number;
  bbox: [number, number, number, number];
  pixelToGps: number[];
  gpsToPixel: number[];
  noDataValue: number | null;
  projectionOffsetM: number;
};

export type TileServerElevationSource = {
  type: "tile-server";
  id: string;
  enabled: boolean;
  name: string;
  tileUrlTemplate: string;
  tileZoom: number;
  tileSize: number;
  encoding: "terrain-rgb";
};

export type ElevationSource =
  | GeoTiffElevationSource
  | TileServerElevationSource;
