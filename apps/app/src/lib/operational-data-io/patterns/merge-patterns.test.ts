import { LabelManager } from "@epanet-js/hydraulic-model";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";
import type { Pattern, Patterns } from "src/hydraulic-model";
import { mergePatterns } from "./merge-patterns";
import type { ParsedPattern } from "./parse-patterns-file";

const patternsOf = (...items: Pattern[]): Patterns =>
  new Map(items.map((p) => [p.id, p]));

const merge = (existing: Patterns, incoming: ParsedPattern[]) => {
  const labelManager = new LabelManager();
  for (const pattern of existing.values()) {
    labelManager.register(pattern.label, "pattern", pattern.id);
  }
  return mergePatterns(existing, incoming, {
    labelManager,
    idGenerator: new ConsecutiveIdsGenerator(Math.max(0, ...existing.keys())),
  });
};

describe("mergePatterns", () => {
  it("appends a pattern whose label is not in the model", () => {
    const existing = patternsOf({
      id: 1,
      label: "PAT1",
      type: "demand",
      multipliers: [1],
    });

    const { patterns, counts } = merge(existing, [
      { label: "NEW", type: "demand", multipliers: [2] },
    ]);

    expect(patterns.size).toEqual(2);
    expect([...patterns.values()].map((p) => p.label)).toContain("NEW");
    expect(counts).toEqual({
      added: 1,
      updated: 0,
      identical: 0,
      untouched: 1,
    });
  });

  it("replaces a same-type match in place, keeping its id", () => {
    const existing = patternsOf({
      id: 7,
      label: "PAT1",
      type: "demand",
      multipliers: [1],
    });

    const { patterns, counts } = merge(existing, [
      { label: "PAT1", type: "demand", multipliers: [9, 9] },
    ]);

    expect(patterns.size).toEqual(1);
    expect(patterns.get(7)).toEqual({
      id: 7,
      label: "PAT1",
      type: "demand",
      multipliers: [9, 9],
    });
    expect(counts.updated).toEqual(1);
  });

  it("matches labels case-insensitively", () => {
    const existing = patternsOf({
      id: 1,
      label: "PAT1",
      type: "demand",
      multipliers: [1],
    });

    const { patterns, counts } = merge(existing, [
      { label: "pat1", type: "demand", multipliers: [2] },
    ]);

    expect(patterns.size).toEqual(1);
    expect(counts.updated).toEqual(1);
  });

  it("promotes an uncategorized pattern to the file's type", () => {
    const existing = patternsOf({ id: 1, label: "PAT1", multipliers: [1] });

    const { patterns, counts } = merge(existing, [
      { label: "PAT1", type: "pumpSpeed", multipliers: [1] },
    ]);

    expect(patterns.get(1)).toEqual({
      id: 1,
      label: "PAT1",
      type: "pumpSpeed",
      multipliers: [1],
    });
    expect(counts.updated).toEqual(1);
  });

  it("keeps the model's type when the file leaves it blank", () => {
    const existing = patternsOf({
      id: 1,
      label: "PAT1",
      type: "demand",
      multipliers: [1],
    });

    const { patterns, counts } = merge(existing, [
      { label: "PAT1", multipliers: [5] },
    ]);

    expect(patterns.get(1)).toEqual({
      id: 1,
      label: "PAT1",
      type: "demand",
      multipliers: [5],
    });
    expect(counts.updated).toEqual(1);
  });

  it("duplicates under a fresh label when two explicit types clash", () => {
    const existing = patternsOf({
      id: 1,
      label: "PAT1",
      type: "demand",
      multipliers: [1],
    });

    const { patterns, counts } = merge(existing, [
      { label: "PAT1", type: "energyPrice", multipliers: [2] },
    ]);

    expect(patterns.get(1)).toEqual({
      id: 1,
      label: "PAT1",
      type: "demand",
      multipliers: [1],
    });

    const appended = [...patterns.values()].find((p) => p.id !== 1)!;
    expect(appended.label).not.toEqual("PAT1");
    expect(appended.type).toEqual("energyPrice");
    expect(counts).toEqual({
      added: 1,
      updated: 0,
      identical: 0,
      untouched: 1,
    });
  });

  it("counts an unchanged match as identical rather than replaced", () => {
    const existing = patternsOf({
      id: 1,
      label: "PAT1",
      type: "demand",
      multipliers: [1, 2],
    });

    const { counts } = merge(existing, [
      { label: "PAT1", type: "demand", multipliers: [1, 2] },
    ]);

    expect(counts).toEqual({
      added: 0,
      updated: 0,
      identical: 1,
      untouched: 0,
    });
  });

  it("never deletes a pattern the file does not mention", () => {
    const existing = patternsOf(
      { id: 1, label: "KEEP", type: "demand", multipliers: [1] },
      { id: 2, label: "ALSO_KEEP", type: "demand", multipliers: [2] },
    );

    const { patterns, counts } = merge(existing, [
      { label: "KEEP", type: "demand", multipliers: [3] },
    ]);

    expect(patterns.get(2)).toEqual({
      id: 2,
      label: "ALSO_KEEP",
      type: "demand",
      multipliers: [2],
    });
    expect(counts.untouched).toEqual(1);
  });
});
