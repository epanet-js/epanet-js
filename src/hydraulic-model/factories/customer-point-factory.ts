import { Position } from "geojson";
import { IdGenerator } from "src/lib/id-generator";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { roundCoordinates } from "src/lib/geometry";

export class CustomerPointFactory {
  private idGenerator: IdGenerator;

  constructor(idGenerator: IdGenerator) {
    this.idGenerator = idGenerator;
  }

  create(coordinates: Position, label?: string): CustomerPoint {
    const id = this.idGenerator.newId();
    return new CustomerPoint(id, roundCoordinates(coordinates), {
      label: label ?? String(id),
    });
  }

  get totalGenerated(): number {
    return this.idGenerator.totalGenerated;
  }
}
