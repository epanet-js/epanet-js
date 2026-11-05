import type { BBox, MultiPolygon } from "geojson";
import turfGetBbox from "@turf/bbox";
import type { IdGenerator } from "@epanet-js/id-generator";
import { Zone, type ZoneId } from "../zones";
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
    return new Zone(id, geometry, turfGetBbox(geometry), {
      label: this.resolveLabel(id, label),
    });
  }

  load({
    id,
    geometry,
    bbox,
    label,
  }: {
    id: ZoneId;
    geometry: MultiPolygon;
    bbox: BBox;
    label: string;
  }): Zone {
    this.labelManager.register(label, "zone", id);
    return new Zone(id, geometry, bbox, { label });
  }

  private resolveLabel(id: number, label?: string): string {
    if (label !== undefined) {
      this.labelManager.register(label, "zone", id);
      return label;
    }
    return this.labelManager.generateFor("zone", id);
  }
}
