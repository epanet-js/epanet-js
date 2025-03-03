import { Asset, AssetId } from "./asset-types";

const typeToPrefix: Record<Asset["type"], string> = {
  pipe: "P",
  junction: "J",
  reservoir: "R",
};

export class LabelManager {
  private labelsDeprecated: Map<string, AssetId[]>;
  private countsPerType: Map<Asset["type"], number>;
  private countsPerLabel: Map<string, number>;

  constructor() {
    this.countsPerLabel = new Map();
    this.countsPerType = new Map();
    this.labelsDeprecated = new Map();
  }

  registerDeprecated(label: string, id: AssetId) {
    this.labelsDeprecated.set(label, [
      ...(this.labelsDeprecated.get(label) || []),
      id,
    ]);
  }

  register(label: string, type: Asset["type"]) {
    this.countsPerType.set(type, (this.countsPerType.get(type) || 0) + 1);
    this.countsPerLabel.set(label, (this.countsPerLabel.get(label) || 0) + 1);
  }

  count(label: string) {
    return this.countsPerLabel.get(label) || 0;
  }

  countDeprecated(label: string) {
    return (this.labelsDeprecated.get(label) || []).length;
  }

  generateFor(type: Asset["type"]) {
    const typeCount = this.countsPerType.get(type) || 0;
    const { label } = this.ensureUnique(type, typeCount);
    this.register(label, type);
    return label;
  }

  generateForDeprecated(id: AssetId, type: Asset["type"]) {
    const candidate = `${typeToPrefix[type]}${id}`;
    return this.ensureUniqueDeprecated(candidate);
  }

  removeDeprecated(label: string, id: AssetId) {
    const ids = (this.labelsDeprecated.get(label) || []).filter(
      (i) => i !== id,
    );
    if (!ids.length) {
      this.labelsDeprecated.delete(label);
      return;
    }

    this.labelsDeprecated.set(label, ids);
  }

  remove(label: string, type: Asset["type"]) {
    this.countsPerType.set(type, (this.countsPerType.get(type) || 1) - 1);
    this.countsPerLabel.set(label, (this.countsPerLabel.get(label) || 1) - 1);
  }

  private ensureUnique(
    type: Asset["type"],
    count: number,
  ): { label: string; nextCount: number } {
    const nextCount = count + 1;
    const candidate = `${typeToPrefix[type]}${nextCount}`;
    if (!this.countsPerLabel.get(candidate)) {
      return { label: candidate, nextCount: nextCount };
    }

    return this.ensureUnique(type, nextCount);
  }

  private ensureUniqueDeprecated(candidate: string, count = 0): string {
    const newCandidate = count > 0 ? `${candidate}.${count}` : candidate;
    if (!this.labelsDeprecated.has(newCandidate)) {
      return newCandidate;
    } else {
      return this.ensureUniqueDeprecated(candidate, count + 1);
    }
  }
}
