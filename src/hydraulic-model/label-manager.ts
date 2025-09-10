import { Asset } from "./asset-types";

const typeToPrefix: Record<Asset["type"], string> = {
  pipe: "P",
  junction: "J",
  reservoir: "R",
  tank: "T",
  pump: "PU",
  valve: "V",
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

  generateSplitLabels(baseLabel: string): [string, string] {
    const MAX_LENGTH = 31;

    const generateUniqueLabel = (baseSuffix: string): string => {
      let counter = 0;
      while (true) {
        const suffix = counter === 0 ? baseSuffix : `${baseSuffix}_${counter}`;
        const maxBaseLength = MAX_LENGTH - suffix.length;

        if (maxBaseLength <= 0) {
          throw new Error(
            `Cannot generate label within ${MAX_LENGTH} character limit`,
          );
        }

        const truncatedBase = baseLabel.substring(0, maxBaseLength);
        const candidate = `${truncatedBase}${suffix}`;

        if (this.count(candidate) === 0) {
          return candidate;
        }

        counter++;
      }
    };

    const label1 = generateUniqueLabel("_1");

    let label2 = generateUniqueLabel("_2");
    let counter = 0;
    while (label2 === label1) {
      label2 = generateUniqueLabel(`_2_${counter}`);
      counter++;
    }

    return [label1, label2];
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
