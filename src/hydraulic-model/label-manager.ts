import { Asset } from "./asset-types";

const typeToPrefix: Record<Asset["type"], string> = {
  pipe: "P",
  junction: "J",
  reservoir: "R",
};

type AssetData = Pick<Asset, "type" | "id">;

export interface LabelGenerator {
  generateFor: (type: Asset["type"], id: Asset["id"]) => string;
}

export class LabelManager implements LabelGenerator {
  private indexPerType: Map<Asset["type"], number>;
  private assetIndex: Map<string, AssetData[]>;

  constructor() {
    this.indexPerType = new Map();
    this.assetIndex = new Map();
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
}
