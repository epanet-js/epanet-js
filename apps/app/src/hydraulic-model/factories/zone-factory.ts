import type { Polygon, MultiPolygon } from "geojson";
import { ConsecutiveIdsGenerator, IdGenerator } from "src/lib/id-generator";
import { Zone, ZoneId } from "src/hydraulic-model/zones";
import { LabelManager } from "src/hydraulic-model/label-manager";

export const buildZonePreviewFactory = (
  labelManager: LabelManager,
): ZoneFactory => {
  const previewLabelManager = new LabelManager();
  previewLabelManager.copyTypeFrom("zone", labelManager);
  return new ZoneFactory(new ConsecutiveIdsGenerator(), previewLabelManager);
};

export class ZoneFactory {
  private idGenerator: IdGenerator;
  private labelManager: LabelManager;

  constructor(idGenerator: IdGenerator, labelManager: LabelManager) {
    this.idGenerator = idGenerator;
    this.labelManager = labelManager;
  }

  create(
    geometry: Polygon | MultiPolygon,
    properties?: { label?: string },
  ): Zone {
    const id = this.idGenerator.newId();
    const resolvedLabel = this.resolveLabel(id, properties?.label);
    return new Zone(id, geometry, {
      label: resolvedLabel,
    });
  }

  load({
    id,
    geometry,
    label,
  }: {
    id: ZoneId;
    geometry: Polygon | MultiPolygon;
    label: string;
  }): Zone {
    this.labelManager.register(label, "zone", id);
    return new Zone(id, geometry, { label });
  }

  get totalGenerated(): number {
    return this.idGenerator.totalGenerated;
  }

  private resolveLabel(id: number, label?: string): string {
    if (label !== undefined) {
      this.labelManager.register(label, "zone", id);
      return label;
    }
    return this.labelManager.generateFor("zone", id);
  }
}
