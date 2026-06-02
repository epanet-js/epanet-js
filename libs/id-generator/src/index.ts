export interface IdGenerator {
  get totalGenerated(): number;
  newId(): number;
}

export class ConsecutiveIdsGenerator implements IdGenerator {
  private last: number;
  constructor(startFrom: number = 0) {
    this.last = startFrom;
  }

  newId(): number {
    this.last = this.last + 1;
    return this.last;
  }

  get totalGenerated(): number {
    return this.last;
  }
}
