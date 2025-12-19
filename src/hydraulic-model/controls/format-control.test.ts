import { formatSimpleControl, formatRuleBasedControl } from "./format-control";
import { SimpleControl, RuleBasedControl } from "./types";

describe("formatSimpleControl", () => {
  it("replaces asset placeholders with resolved IDs", () => {
    const control: SimpleControl = {
      template: "LINK {{0}} OPEN IF NODE {{1}} ABOVE 100",
      assetReferences: [
        { assetId: 1, isActionTarget: true },
        { assetId: 2, isActionTarget: false },
      ],
    };

    const idResolver = (id: number) => (id === 1 ? "P1" : "T1");

    const result = formatSimpleControl(control, idResolver);

    expect(result).toBe("LINK P1 OPEN IF NODE T1 ABOVE 100");
  });

  it("handles control with single asset reference", () => {
    const control: SimpleControl = {
      template: "LINK {{0}} OPEN AT TIME 6",
      assetReferences: [{ assetId: 5, isActionTarget: true }],
    };

    const idResolver = (id: number) => `PUMP${id}`;

    const result = formatSimpleControl(control, idResolver);

    expect(result).toBe("LINK PUMP5 OPEN AT TIME 6");
  });

  it("preserves template when no asset references exist", () => {
    const control: SimpleControl = {
      template: "LINK UnknownPipe OPEN AT TIME 6",
      assetReferences: [],
    };

    const idResolver = () => "unused";

    const result = formatSimpleControl(control, idResolver);

    expect(result).toBe("LINK UnknownPipe OPEN AT TIME 6");
  });

  it("keeps unresolved placeholders when reference is missing", () => {
    const control: SimpleControl = {
      template: "LINK {{0}} OPEN IF NODE {{1}} ABOVE 100",
      assetReferences: [{ assetId: 1, isActionTarget: true }],
    };

    const idResolver = (id: number) => `Asset${id}`;

    const result = formatSimpleControl(control, idResolver);

    expect(result).toBe("LINK Asset1 OPEN IF NODE {{1}} ABOVE 100");
  });

  it("preserves inline comments", () => {
    const control: SimpleControl = {
      template:
        "LINK {{0}} OPEN IF NODE {{1}} ABOVE 100 ;open when tank is full",
      assetReferences: [
        { assetId: 1, isActionTarget: true },
        { assetId: 2, isActionTarget: false },
      ],
    };

    const idResolver = (id: number) => (id === 1 ? "P1" : "T1");

    const result = formatSimpleControl(control, idResolver);

    expect(result).toBe(
      "LINK P1 OPEN IF NODE T1 ABOVE 100 ;open when tank is full",
    );
  });
});

describe("formatRuleBasedControl", () => {
  it("replaces rule ID and asset placeholders", () => {
    const rule: RuleBasedControl = {
      ruleId: "TankControl",
      template: `RULE {{id}}
IF NODE {{0}} LEVEL > 100
THEN LINK {{1}} STATUS IS OPEN`,
      assetReferences: [
        { assetId: 10, isActionTarget: false },
        { assetId: 20, isActionTarget: true },
      ],
    };

    const idResolver = (id: number) => (id === 10 ? "Tank1" : "Pump1");

    const result = formatRuleBasedControl(rule, idResolver);

    expect(result).toBe(`RULE TankControl
IF NODE Tank1 LEVEL > 100
THEN LINK Pump1 STATUS IS OPEN`);
  });

  it("handles multiple rule ID placeholders", () => {
    const rule: RuleBasedControl = {
      ruleId: "Rule1",
      template: "RULE {{id}} ;rule {{id}} controls tank",
      assetReferences: [],
    };

    const idResolver = () => "unused";

    const result = formatRuleBasedControl(rule, idResolver);

    expect(result).toBe("RULE Rule1 ;rule Rule1 controls tank");
  });

  it("handles rule with multiple actions (THEN/ELSE/AND)", () => {
    const rule: RuleBasedControl = {
      ruleId: "1",
      template: `RULE {{id}}
IF NODE {{0}} LEVEL > 100
THEN LINK {{1}} STATUS IS OPEN
AND LINK {{2}} STATUS IS CLOSED
ELSE LINK {{1}} STATUS IS CLOSED`,
      assetReferences: [
        { assetId: 1, isActionTarget: false },
        { assetId: 2, isActionTarget: true },
        { assetId: 3, isActionTarget: true },
      ],
    };

    const idResolver = (id: number) => `Asset${id}`;

    const result = formatRuleBasedControl(rule, idResolver);

    expect(result).toBe(`RULE 1
IF NODE Asset1 LEVEL > 100
THEN LINK Asset2 STATUS IS OPEN
AND LINK Asset3 STATUS IS CLOSED
ELSE LINK Asset2 STATUS IS CLOSED`);
  });

  it("preserves inline comments", () => {
    const rule: RuleBasedControl = {
      ruleId: "1",
      template: `RULE {{id}} ;main control
IF NODE {{0}} LEVEL > 100
THEN LINK {{1}} STATUS IS OPEN ;activate`,
      assetReferences: [
        { assetId: 1, isActionTarget: false },
        { assetId: 2, isActionTarget: true },
      ],
    };

    const idResolver = (id: number) => (id === 1 ? "T1" : "P1");

    const result = formatRuleBasedControl(rule, idResolver);

    expect(result).toBe(`RULE 1 ;main control
IF NODE T1 LEVEL > 100
THEN LINK P1 STATUS IS OPEN ;activate`);
  });
});
