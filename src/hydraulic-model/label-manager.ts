import { Asset, AssetId } from "./asset-types";

const typeToPrefix: Record<Asset["type"], string> = {
  pipe: "P",
  junction: "J",
  reservoir: "R",
};

export class LabelManager {
  private labelsDeprecated: Map<string, AssetId[]>;
  private indexPerType: Map<Asset["type"], number>;
  private countsPerLabel: Map<string, number>;

  constructor() {
    this.countsPerLabel = new Map();
    this.indexPerType = new Map();
    this.labelsDeprecated = new Map();
  }

  registerDeprecated(label: string, id: AssetId) {
    this.labelsDeprecated.set(label, [
      ...(this.labelsDeprecated.get(label) || []),
      id,
    ]);
  }

  register(label: string, _type: Asset["type"]) {
    this.countsPerLabel.set(label, (this.countsPerLabel.get(label) || 0) + 1);
  }

  count(label: string) {
    return this.countsPerLabel.get(label) || 0;
  }

  countDeprecated(label: string) {
    return (this.labelsDeprecated.get(label) || []).length;
  }

  generateFor(type: Asset["type"]) {
    const nextIndex = this.indexPerType.get(type) || 1;
    const { label, index: effectiveIndex } = this.ensureUnique(type, nextIndex);
    this.indexPerType.set(type, effectiveIndex);
    this.countsPerLabel.set(label, (this.countsPerLabel.get(label) || 0) + 1);
    return label;
  }

  remove(label: string, type: Asset["type"]) {
    const regexp = new RegExp(`^(?:${typeToPrefix[type]})(\\d+)$`);
    const match = label.match(regexp);
    if (match) {
      const index = parseInt(match[1]);

      this.indexPerType.set(
        type,
        Math.min(this.indexPerType.get(type) as number, index),
      );
    }
    this.countsPerLabel.set(label, (this.countsPerLabel.get(label) || 1) - 1);
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

  private ensureUnique(
    type: Asset["type"],
    index: number,
  ): { label: string; index: number } {
    const candidate = `${typeToPrefix[type]}${index}`;
    if (!this.countsPerLabel.get(candidate)) {
      return { label: candidate, index: index };
    }

    return this.ensureUnique(type, index + 1);
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
