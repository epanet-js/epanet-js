import { ConsecutiveIdsGenerator, IdGenerator } from "../id-generator";

export class ZoneLabelGenerator {
  private idGenerator: IdGenerator;
  constructor() {
    const startNumber = 1;
    this.idGenerator = new ConsecutiveIdsGenerator(startNumber);
  }

  next(): string {
    return `Z${this.idGenerator.newId()}`;
  }
}
