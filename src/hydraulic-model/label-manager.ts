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

  generateNextLabel(inputLabel: string): string {
    const MAX_LENGTH = 31;
    const { baseLabel, nextCounter } = this.extractBaseAndCounter(inputLabel);

    const generateLabelWithCounter = (counter: number): string => {
      const suffix = `_${counter}`;
      const maxBaseLength = MAX_LENGTH - suffix.length;

      if (maxBaseLength <= 0) {
        throw new Error(
          `Cannot generate label within ${MAX_LENGTH} character limit`,
        );
      }

      const truncatedBase = baseLabel.substring(0, maxBaseLength);
      return `${truncatedBase}${suffix}`;
    };

    let counter = nextCounter;
    while (true) {
      const candidate = generateLabelWithCounter(counter);

      if (this.count(candidate) === 0) {
        return candidate;
      }

      counter++;
    }
  }

  private extractBaseAndCounter(inputLabel: string): {
    baseLabel: string;
    nextCounter: number;
  } {
    const counterPattern = /^(.+)_(\d+)$/;
    const match = inputLabel.match(counterPattern);

    if (match) {
      const baseLabel = match[1];
      const currentCounter = parseInt(match[2], 10);
      return { baseLabel, nextCounter: currentCounter + 1 };
    }

    return { baseLabel: inputLabel, nextCounter: 1 };
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
