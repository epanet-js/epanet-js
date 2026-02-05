import { Asset } from "./asset-types";

export type LabelType = Asset["type"] | "pattern" | "curve";

type LabelEntry = {
  id: number;
  type: LabelType;
};

const labelPrefixes: Record<LabelType, string> = {
  pipe: "P",
  junction: "J",
  reservoir: "R",
  tank: "T",
  pump: "PU",
  valve: "V",
  pattern: "PAT",
  curve: "C",
};

type LabelGroup = "pattern" | "curve" | "node" | "link";

export interface LabelGenerator {
  generateFor: (type: Asset["type"], id: Asset["id"]) => string;
}

export class LabelManager implements LabelGenerator {
  private indexPerType: Map<LabelType, number>;
  private labelToEntries: Map<string, LabelEntry[]>;

  constructor() {
    this.indexPerType = new Map();
    this.labelToEntries = new Map();
  }

  private normalizeLabel(label: string): string {
    return label.toUpperCase();
  }

  register(label: string, type: LabelType, id: number) {
    const normalizedLabel = this.normalizeLabel(label);

    const entries = this.labelToEntries.get(normalizedLabel) || [];
    if (entries.some((e) => e.id === id)) return;

    const prefix = labelPrefixes[type];
    const regexp = new RegExp(`^(?:${prefix})(\\d+)$`, "i");
    const match = label.match(regexp);
    if (match) {
      const index = parseInt(match[1]);
      const currentIndex = this.indexPerType.get(type);
      if (currentIndex === undefined || index < currentIndex) {
        this.indexPerType.set(type, index);
      }
    }

    this.labelToEntries.set(normalizedLabel, [...entries, { id, type }]);
  }

  count(label: string): number {
    return (this.labelToEntries.get(this.normalizeLabel(label)) || []).length;
  }

  isLabelAvailable(
    label: string,
    type: LabelType,
    excludeId?: number,
  ): boolean {
    const normalizedLabel = this.normalizeLabel(label);
    const entries = this.labelToEntries.get(normalizedLabel) || [];

    if (entries.length === 0) return true;

    return !entries.some((entry) => {
      if (excludeId !== undefined && entry.id === excludeId) return false;
      return isSameLabelGroup(entry.type, type);
    });
  }

  getIdByLabel(label: string, type: LabelType): number | undefined {
    const normalizedLabel = this.normalizeLabel(label);
    const entries = this.labelToEntries.get(normalizedLabel) || [];

    return entries.find((e) => isSameLabelGroup(e.type, type))?.id;
  }

  generateFor(type: LabelType, id: number): string {
    const nextIndex = this.indexPerType.get(type) || 1;
    const { label, index: effectiveIndex } = this.ensureUnique(type, nextIndex);
    const normalizedLabel = this.normalizeLabel(label);
    this.indexPerType.set(type, effectiveIndex);

    const entries = this.labelToEntries.get(normalizedLabel) || [];
    this.labelToEntries.set(normalizedLabel, [...entries, { id, type }]);

    return label;
  }

  remove(label: string, type: LabelType, id: number) {
    const normalizedLabel = this.normalizeLabel(label);

    const entries = this.labelToEntries.get(normalizedLabel) || [];
    const filtered = entries.filter((e) => e.id !== id);
    if (filtered.length === 0) {
      this.labelToEntries.delete(normalizedLabel);
    } else {
      this.labelToEntries.set(normalizedLabel, filtered);
    }

    const prefix = labelPrefixes[type];
    const regexp = new RegExp(`^(?:${prefix})(\\d+)$`, "i");
    const match = label.match(regexp);
    if (match) {
      const index = parseInt(match[1]);
      const currentIndex = this.indexPerType.get(type);
      if (currentIndex === undefined || index < currentIndex) {
        this.indexPerType.set(type, index);
      }
    }
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
    type: LabelType,
    index: number,
  ): { label: string; index: number } {
    const prefix = labelPrefixes[type];

    let iterationIndex = index;
    while (true) {
      const candidate = `${prefix}${iterationIndex}`;
      const normalizedCandidate = this.normalizeLabel(candidate);
      const entries = this.labelToEntries.get(normalizedCandidate) || [];

      if (!entries.some((e) => e.type === type)) {
        return { label: candidate, index: iterationIndex };
      }
      iterationIndex++;
    }
  }
}

const isNodeType = (t: LabelType) =>
  t === "junction" || t === "reservoir" || t === "tank";

const getLabelUniqueGroup = (type: LabelType): LabelGroup => {
  if (type === "pattern" || type === "curve") {
    return type;
  }
  return isNodeType(type) ? "node" : "link";
};

const isSameLabelGroup = (typeA: LabelType, typeB: LabelType) => {
  return getLabelUniqueGroup(typeA) === getLabelUniqueGroup(typeB);
};
