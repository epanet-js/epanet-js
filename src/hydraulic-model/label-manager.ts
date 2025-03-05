import { Asset, AssetId } from "./asset-types";

const typeToPrefix: Record<Asset["type"], string> = {
  pipe: "P",
  junction: "J",
  reservoir: "R",
};

type AssetData = Pick<Asset, "type" | "id">;

export class LabelManager {
  private labelsDeprecated: Map<string, AssetId[]>;
  private indexPerType: Map<Asset["type"], number>;
  private assetIndex: Map<string, AssetData[]>;

  constructor() {
    this.indexPerType = new Map();
    this.labelsDeprecated = new Map();
    this.assetIndex = new Map();
  }

  registerDeprecated(label: string, id: AssetId) {
    this.labelsDeprecated.set(label, [
      ...(this.labelsDeprecated.get(label) || []),
      id,
    ]);
  }

  register(label: string, type: Asset["type"], id: Asset["id"]) {
    if ((this.assetIndex.get(label) || []).some((a) => a.id === id)) return;

    const regexp = new RegExp(`^(?:${typeToPrefix[type]})(\\d+)$`);
    const match = label.match(regexp);
    if (match) {
      const index = parseInt(match[1]);

      this.indexPerType.set(
        type,
        Math.min(this.indexPerType.get(type) as number, index),
      );
    }

    this.assetIndex.set(label, [
      ...(this.assetIndex.get(label) || []),
      { type, id },
    ]);
  }

  count(label: string) {
    return (this.assetIndex.get(label) || []).length;
  }

  countDeprecated(label: string) {
    return (this.labelsDeprecated.get(label) || []).length;
  }

  generateFor(type: Asset["type"], id: Asset["id"]) {
    const nextIndex = this.indexPerType.get(type) || 1;
    const { label, index: effectiveIndex } = this.ensureUnique(type, nextIndex);
    this.indexPerType.set(type, effectiveIndex);
    this.assetIndex.set(label, [
      ...(this.assetIndex.get(label) || []),
      { id, type },
    ]);
    return label;
  }

  remove(label: string, type: Asset["type"], id: Asset["id"]) {
    const regexp = new RegExp(`^(?:${typeToPrefix[type]})(\\d+)$`);
    const match = label.match(regexp);
    if (match) {
      const index = parseInt(match[1]);

      this.indexPerType.set(
        type,
        Math.min(this.indexPerType.get(type) as number, index),
      );
    }
    this.assetIndex.set(
      label,
      (this.assetIndex.get(label) || []).filter((a) => a.id !== id),
    );
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
    let iterationIndex = index;
    while (true) {
      const candidate = `${typeToPrefix[type]}${iterationIndex}`;
      if (
        !(this.assetIndex.get(candidate) || []).some((a) => a.type === type)
      ) {
        return { label: candidate, index: iterationIndex };
      }
      iterationIndex++;
    }
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
