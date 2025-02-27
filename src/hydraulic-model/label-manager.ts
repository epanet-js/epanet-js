import { AssetId } from "./asset-types";

export class LabelManager {
  private labels: Map<string, AssetId[]>;

  constructor() {
    this.labels = new Map();
  }

  register(label: string, id: AssetId) {
    this.labels.set(label, [...(this.labels.get(label) || []), id]);
  }

  count(label: string) {
    return (this.labels.get(label) || []).length;
  }

  generateFor(id: AssetId) {
    return this.ensureUnique(id);
  }

  remove(label: string, id: AssetId) {
    this.labels.set(
      label,
      (this.labels.get(label) || []).filter((i) => i === id),
    );
  }

  private ensureUnique(candidate: string, count = 0): string {
    const newCandidate = count > 0 ? `${candidate}.${count}` : candidate;
    if (!this.labels.has(newCandidate)) {
      return newCandidate;
    } else {
      return this.ensureUnique(candidate, count + 1);
    }
  }
}
