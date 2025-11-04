export class IdGenerator {
  private last: number;
  constructor() {
    this.last = 0;
  }

  newId(): number {
    this.last = this.last + 1;
    return this.last;
  }

  get totalGenerated(): number {
    return this.last;
  }
}
