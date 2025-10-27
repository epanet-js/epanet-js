export class IdMapper {
  private idsLookup: string[] = [];
  private idxLookup = new Map<string, number>();

  getOrAssignIdx(id: string): number {
    let idx = this.idxLookup.get(id);
    if (idx === undefined) {
      idx = this.idsLookup.length;
      this.idxLookup.set(id, idx);
      this.idsLookup.push(id);
    }
    return idx;
  }

  getIdx(id: string): number | undefined {
    return this.idxLookup.get(id);
  }

  getId(idx: number): string | undefined {
    return this.idsLookup[idx];
  }

  getIdsLookup(): string[] {
    return this.idsLookup;
  }

  get count(): number {
    return this.idsLookup.length;
  }
}
