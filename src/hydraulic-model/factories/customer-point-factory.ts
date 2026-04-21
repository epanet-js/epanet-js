import { Position } from "geojson";
import { IdGenerator } from "src/lib/id-generator";
import {
  CustomerPoint,
  CustomerPointId,
} from "src/hydraulic-model/customer-points";
import { roundCoordinates } from "src/lib/geometry";
import { LabelManager } from "src/hydraulic-model/label-manager";

export class CustomerPointFactory {
  private idGenerator: IdGenerator;
  private labelManager: LabelManager;

  constructor(idGenerator: IdGenerator, labelManager: LabelManager) {
    this.idGenerator = idGenerator;
    this.labelManager = labelManager;
  }

  create(coordinates: Position, label?: string): CustomerPoint {
    const id = this.idGenerator.newId();
    const resolvedLabel = this.resolveLabel(id, label);
    return new CustomerPoint(id, roundCoordinates(coordinates), {
      label: resolvedLabel,
    });
  }

  load({
    id,
    coordinates,
    label,
  }: {
    id: CustomerPointId;
    coordinates: Position;
    label: string;
  }): CustomerPoint {
    this.labelManager.register(label, "customerPoint", id);
    return new CustomerPoint(id, roundCoordinates(coordinates), { label });
  }

  get totalGenerated(): number {
    return this.idGenerator.totalGenerated;
  }

  private resolveLabel(id: number, label?: string): string {
    if (label !== undefined) {
      this.labelManager.register(label, "customerPoint", id);
      return label;
    }
    return this.labelManager.generateFor("customerPoint", id);
  }
}
