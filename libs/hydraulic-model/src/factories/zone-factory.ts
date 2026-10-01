import type { MultiPolygon } from "geojson";
import turfGetBbox from "@turf/bbox";
import type { IdGenerator } from "@epanet-js/id-generator";
import type { Zone } from "../zones";
import { ZoneLabelGenerator } from "../label-manager";

export class ZoneFactory {
  private idGenerator: IdGenerator;
  private labelGenerator: ZoneLabelGenerator;

  constructor(
    idGenerator: IdGenerator,
    labelGenerator: ZoneLabelGenerator = new ZoneLabelGenerator(),
  ) {
    this.idGenerator = idGenerator;
    this.labelGenerator = labelGenerator;
  }

  create(geometry: MultiPolygon, label?: string): Zone {
    return {
      id: this.idGenerator.newId(),
      label: label ?? this.labelGenerator.next(),
      geometry,
      bbox: turfGetBbox(geometry),
    };
  }
}
