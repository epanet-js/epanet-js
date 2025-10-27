import bbox from "@turf/bbox";
import { lineString } from "@turf/helpers";
import Flatbush from "flatbush";
import { Position } from "geojson";
import { BinaryData } from "./buffers";

export class GeoIndexBuilder {
  private geoIndex: Flatbush;

  constructor(private readonly size: number) {
    this.geoIndex = new Flatbush(Math.max(size, 1));
  }

  add(coordinates: Position[]): void {
    if (coordinates.length === 1) {
      const [lon, lat] = coordinates[0];
      this.geoIndex.add(lon, lat, lon, lat);
      return;
    }
    const bounds = bbox(lineString(coordinates));
    this.geoIndex.add(bounds[0], bounds[1], bounds[2], bounds[3]);
  }

  finalize(): BinaryData {
    if (this.size === 0) {
      this.geoIndex.add(0, 0, 0, 0);
    }
    this.geoIndex.finish();
    return this.geoIndex.data;
  }
}
