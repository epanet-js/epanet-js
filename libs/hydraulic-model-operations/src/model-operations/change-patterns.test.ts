import { describe, it, expect } from "vitest";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { changePatterns } from "./change-patterns";

const IDS = { R1: 1, P1: 10, P2: 11 } as const;

const aModelWithAHeadPattern = () =>
  HydraulicModelBuilder.with()
    .aPattern(IDS.P1, "HEAD", [1, 1.1], "reservoirHead")
    .aPattern(IDS.P2, "SPARE", [1, 0.9], "reservoirHead")
    .aReservoir(IDS.R1, { headPatternId: IDS.P1 })
    .build();

describe("changePatterns", () => {
  it("removes a pattern no asset uses", () => {
    const model = aModelWithAHeadPattern();
    const patterns = new Map(model.patterns);
    patterns.delete(IDS.P2);

    expect(() => changePatterns(model, patterns)).not.toThrow();
  });

  it("refuses to remove a pattern an asset uses", () => {
    const model = aModelWithAHeadPattern();
    const patterns = new Map(model.patterns);
    patterns.delete(IDS.P1);

    expect(() => changePatterns(model, patterns)).toThrow(
      "Cannot remove pattern HEAD; it is in use",
    );
  });
});
