export class IdGenerator {
  private last: string;
  constructor() {
    this.last = "0";
  }

  newId() {
    const newId = String(parseInt(this.last) + 1);
    this.last = newId;
    return newId;
  }
}
