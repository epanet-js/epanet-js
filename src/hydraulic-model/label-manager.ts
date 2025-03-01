import { Asset, AssetId } from "./asset-types";

const typeToPrefix: Record<Asset["type"], string> = {
  pipe: "P",
  junction: "J",
  reservoir: "R",
};

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

  generateFor(id: AssetId, type: Asset["type"]) {
    const candidate = `${typeToPrefix[type]}${id}`;
    return this.ensureUnique(candidate);
  }

  remove(label: string, id: AssetId) {
    const ids = (this.labels.get(label) || []).filter((i) => i !== id);
    if (!ids.length) {
      this.labels.delete(label);
      return;
    }

    this.labels.set(label, ids);
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
