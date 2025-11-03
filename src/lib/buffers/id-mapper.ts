export class IdMapper {
  private idsLookup: number[] = [];
  private idxLookup = new Map<number, number>();

  getOrAssignIdx(id: number): number {
    let idx = this.idxLookup.get(id);
    if (idx === undefined) {
      idx = this.idsLookup.length;
      this.idxLookup.set(id, idx);
      this.idsLookup.push(id);
    }
    return idx;
  }

  getIdx(id: number): number {
    const idx = this.idxLookup.get(id);
    if (idx === undefined) throw new RangeError("Index out of range");
    return idx;
  }

  getId(idx: number): number {
    return this.idsLookup[idx];
  }

  getIdsLookup(): number[] {
    return this.idsLookup;
  }

  get count(): number {
    return this.idsLookup.length;
  }
}
