import { PatternId, Patterns } from "../patterns";
import { Node, NodeProperties } from "./node";

export type ReservoirProperties = {
  type: "reservoir";
  head: number | null;
  headPatternId?: PatternId;
} & NodeProperties;

export const reservoirQuantities = [
  "elevation",
  "head",
  "initialQuality",
] as const;
export type ReservoirQuantity = (typeof reservoirQuantities)[number];

export class Reservoir extends Node<ReservoirProperties> {
  copy() {
    return new Reservoir(this.id, [...this.coordinates], {
      ...this.properties,
    });
  }

  get head() {
    return this.properties.head;
  }

  get headPatternId() {
    return this.properties.headPatternId;
  }
}

export const calculateAverageHead = (
  reservoir: Reservoir,
  patterns: Patterns,
): number | null => {
  const head = reservoir.head;
  if (head === null) return null;
  if (reservoir.headPatternId) {
    const pattern = patterns.get(reservoir.headPatternId);
    if (pattern && pattern.multipliers.length > 0) {
      const avgMultiplier =
        pattern.multipliers.reduce((sum, m) => sum + m, 0) /
        pattern.multipliers.length;
      return head * avgMultiplier;
    }
  }
  return head;
};
