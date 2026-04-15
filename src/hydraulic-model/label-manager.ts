import { Asset } from "./asset-types";

export type LabelType = Asset["type"] | "pattern" | "curve" | "customerPoint";

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
  customerPoint: "CP",
};

type LabelGroup = "pattern" | "curve" | "node" | "link" | "customerPoint";

export class LabelManager {
  private indexPerType: Map<LabelType, number>;
  private labelToEntries: Map<string, LabelEntry[]>;

  constructor(sharedCounters?: Map<LabelType, number>) {
    this.indexPerType = sharedCounters ?? new Map();
    this.labelToEntries = new Map();
  }

  adoptCounters(counters: Map<LabelType, number>): void {
    for (const [type, index] of this.indexPerType) {
      const existing = counters.get(type) ?? 0;
      counters.set(type, Math.max(existing, index));
    }
    this.indexPerType = counters;
  }

  private normalizeLabel(label: string): string {
    return label.toUpperCase();
  }

  register(label: string, type: LabelType, id: number) {
    const normalizedLabel = this.normalizeLabel(label);

    const entries = this.labelToEntries.get(normalizedLabel) || [];
    if (entries.some((e) => e.id === id)) return;

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

  search(
    query: string,
    limit = 200,
  ): Array<{ label: string; type: LabelType; id: number }> {
    const normalizedQuery = this.normalizeLabel(query);
    if (normalizedQuery.length === 0) return [];

    type Match = { label: string; type: LabelType; id: number };
    const exactMatches: Match[] = [];
    const prefixMatches: Match[] = [];
    const substringMatches: Match[] = [];

    const total = () =>
      exactMatches.length + prefixMatches.length + substringMatches.length;

    for (const [label, entries] of this.labelToEntries) {
      const matchIndex = label.indexOf(normalizedQuery);
      if (matchIndex === -1) continue;
      const bucket =
        label === normalizedQuery
          ? exactMatches
          : matchIndex === 0
            ? prefixMatches
            : substringMatches;
      for (const entry of entries) {
        bucket.push({ label, type: entry.type, id: entry.id });
        if (total() >= limit) break;
      }
      if (total() >= limit) break;
    }

    return [...exactMatches, ...prefixMatches, ...substringMatches].slice(
      0,
      limit,
    );
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
    this.indexPerType.set(type, effectiveIndex + 1);

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
  if (type === "pattern" || type === "curve" || type === "customerPoint") {
    return type;
  }
  return isNodeType(type) ? "node" : "link";
};

const isSameLabelGroup = (typeA: LabelType, typeB: LabelType) => {
  return getLabelUniqueGroup(typeA) === getLabelUniqueGroup(typeB);
};
