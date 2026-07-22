import { Asset } from "./asset-types";
import { MAX_CUSTOMER_POINT_LABEL_LENGTH } from "./customer-points";

export type LabelType = Asset["type"] | "pattern" | "curve" | "customerPoint";

type LabelLengthRule = {
  maxByteLength?: number;
  maxLength?: number;
};

type LabelRule = LabelLengthRule & {
  allowedChars?: RegExp;
};

const ASSET_LABEL_ALLOWED_CHARS = /(?![\s;])[\x00-\xFF]/;
const ASSET_LABEL_MAX_BYTES = 31;
export const EXTENDED_ASSET_LABEL_MAX_BYTES = 64;

const defaultLabelRule: LabelRule = {
  allowedChars: ASSET_LABEL_ALLOWED_CHARS,
  maxByteLength: ASSET_LABEL_MAX_BYTES,
};

const customerPointLabelRule: LabelRule = {
  maxLength: MAX_CUSTOMER_POINT_LABEL_LENGTH,
};

const rulesForType = (type: LabelType): LabelRule =>
  type === "customerPoint" ? customerPointLabelRule : defaultLabelRule;

const filterByAllowedChars = (s: string, pattern: RegExp): string =>
  s
    .split("")
    .filter((char) => pattern.test(char))
    .join("");

const byteLength = (s: string): number => new TextEncoder().encode(s).length;

const truncateToByteLength = (s: string, maxBytes: number): string => {
  if (byteLength(s) <= maxBytes) return s;
  let out = s;
  while (byteLength(out) > maxBytes) out = out.slice(0, -1);
  return out;
};

const truncateToCharLength = (s: string, maxChars: number): string =>
  s.length <= maxChars ? s : s.slice(0, maxChars);

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
    this.indexPerType = sharedCounters ?? new Map<LabelType, number>();
    this.labelToEntries = new Map();
  }

  adoptCounters(counters: Map<LabelType, number>): void {
    for (const [type, index] of this.indexPerType) {
      const existing = counters.get(type) ?? 0;
      counters.set(type, Math.max(existing, index));
    }
    this.indexPerType = counters;
  }

  copyTypeFrom(type: LabelType, source: LabelManager): void {
    const sourceCounter = source.indexPerType.get(type);
    if (sourceCounter !== undefined) {
      this.indexPerType.set(type, sourceCounter);
    }
    for (const [label, entries] of source.labelToEntries) {
      for (const entry of entries) {
        if (entry.type === type) {
          this.register(label, type, entry.id);
        }
      }
    }
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

  static sanitizeLabel(
    raw: string,
    type: LabelType,
    maxByteLength?: number,
  ): string {
    const rules = rulesForType(type);
    const byteLimit =
      maxByteLength !== undefined && rules.maxByteLength !== undefined
        ? maxByteLength
        : rules.maxByteLength;
    let next = raw;
    if (rules.allowedChars)
      next = filterByAllowedChars(next, rules.allowedChars);
    if (byteLimit !== undefined) next = truncateToByteLength(next, byteLimit);
    if (rules.maxLength !== undefined)
      next = truncateToCharLength(next, rules.maxLength);
    return next;
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

  generateNextLabel(
    inputLabel: string,
    rules: LabelLengthRule = defaultLabelRule,
  ): string {
    const { baseLabel, nextCounter } = this.extractBaseAndCounter(inputLabel);

    const generateLabelWithCounter = (counter: number): string => {
      const suffix = `_${counter}`;

      if (rules.maxByteLength !== undefined) {
        const maxBaseBytes = rules.maxByteLength - suffix.length;
        if (maxBaseBytes <= 0) {
          throw new Error(
            `Cannot generate label within ${rules.maxByteLength} byte limit`,
          );
        }
        return `${truncateToByteLength(baseLabel, maxBaseBytes)}${suffix}`;
      }

      if (rules.maxLength !== undefined) {
        const maxBaseChars = rules.maxLength - suffix.length;
        if (maxBaseChars <= 0) {
          throw new Error(
            `Cannot generate label within ${rules.maxLength} character limit`,
          );
        }
        return `${baseLabel.slice(0, maxBaseChars)}${suffix}`;
      }

      return `${baseLabel}${suffix}`;
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
