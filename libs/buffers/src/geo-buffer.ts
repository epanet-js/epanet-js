import bbox from "@turf/bbox";
import { lineString } from "@turf/helpers";
import Flatbush from "flatbush";
import { Position } from "geojson";
import type { BinaryData } from "./buffers";

export function addPlaceholderMatchingNoSearch(geoIndex: Flatbush): void {
  geoIndex.add(Infinity, Infinity, -Infinity, -Infinity);
}

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
      addPlaceholderMatchingNoSearch(this.geoIndex);
    }
    this.geoIndex.finish();
    return this.geoIndex.data;
  }
}
