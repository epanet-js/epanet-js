import type { MultiPolygon } from "geojson";
import turfGetBbox from "@turf/bbox";
import type { IdGenerator } from "@epanet-js/id-generator";
import type { Zone } from "../zones";
import { LabelManager } from "../label-manager";

export class ZoneFactory {
  private idGenerator: IdGenerator;
  private labelManager: LabelManager;

  constructor(
    idGenerator: IdGenerator,
    labelManager: LabelManager = new LabelManager(),
  ) {
    this.idGenerator = idGenerator;
    this.labelManager = labelManager;
  }

  create(geometry: MultiPolygon, label?: string): Zone {
    const id = this.idGenerator.newId();
    return {
      id,
      label: this.resolveLabel(id, label),
      geometry,
      bbox: turfGetBbox(geometry),
    };
  }

  load(zone: Zone): Zone {
    this.labelManager.register(zone.label, "zone", zone.id);
    return zone;
  }

  private resolveLabel(id: number, label?: string): string {
    if (label !== undefined) {
      this.labelManager.register(label, "zone", id);
      return label;
    }
    return this.labelManager.generateFor("zone", id);
  }
}
