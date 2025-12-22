import {
  parseSimpleControlsFromText,
  parseRulesFromText,
  parseControlsFromText,
  createLabelResolverFromAssets,
  LabelResolver,
} from "./parse-controls";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";

describe("parseSimpleControlsFromText", () => {
  const createResolver = (mapping: Record<string, number>): LabelResolver => {
    return (_keyword, label) => mapping[label.toUpperCase()];
  };

  it("parses empty text", () => {
    const result = parseSimpleControlsFromText("", createResolver({}));
    expect(result).toEqual([]);
  });

  it("parses whitespace-only text", () => {
    const result = parseSimpleControlsFromText(
      "   \n  \n  ",
      createResolver({}),
    );
    expect(result).toEqual([]);
  });

  it("parses single control with link and node", () => {
    const resolver = createResolver({ P1: 1, T1: 2 });
    const text = "LINK P1 OPEN IF NODE T1 ABOVE 100";

    const result = parseSimpleControlsFromText(text, resolver);

    expect(result).toHaveLength(1);
    expect(result[0].template).toBe("LINK {{0}} OPEN IF NODE {{1}} ABOVE 100");
    expect(result[0].assetReferences).toHaveLength(2);
    expect(result[0].assetReferences[0].assetId).toBe(1);
    expect(result[0].assetReferences[0].isActionTarget).toBe(true);
    expect(result[0].assetReferences[1].assetId).toBe(2);
    expect(result[0].assetReferences[1].isActionTarget).toBe(false);
  });

  it("parses multiple controls", () => {
    const resolver = createResolver({ P1: 1, T1: 2, PUMP1: 3 });
    const text = `LINK P1 OPEN IF NODE T1 ABOVE 100
LINK P1 CLOSED IF NODE T1 BELOW 50
LINK PUMP1 OPEN AT TIME 6`;

    const result = parseSimpleControlsFromText(text, resolver);

    expect(result).toHaveLength(3);
    expect(result[0].assetReferences[0].isActionTarget).toBe(true);
    expect(result[1].assetReferences[0].isActionTarget).toBe(true);
    expect(result[2].assetReferences[0].isActionTarget).toBe(true);
  });

  it("keeps unresolved labels as-is in template", () => {
    const resolver = createResolver({ P1: 1 });
    const text = "LINK P1 OPEN IF NODE UNKNOWN_TANK ABOVE 100";

    const result = parseSimpleControlsFromText(text, resolver);

    expect(result).toHaveLength(1);
    expect(result[0].template).toBe(
      "LINK {{0}} OPEN IF NODE UNKNOWN_TANK ABOVE 100",
    );
    expect(result[0].assetReferences).toHaveLength(1);
  });

  it("handles case-insensitive keywords", () => {
    const resolver = createResolver({ P1: 1, T1: 2 });
    const text = "link P1 open if node T1 above 100";

    const result = parseSimpleControlsFromText(text, resolver);

    expect(result).toHaveLength(1);
    expect(result[0].assetReferences).toHaveLength(2);
  });

  it("preserves inline comments", () => {
    const resolver = createResolver({ P1: 1, T1: 2 });
    const text = "LINK P1 OPEN IF NODE T1 ABOVE 100 ;open when full";

    const result = parseSimpleControlsFromText(text, resolver);

    expect(result[0].template).toContain(";open when full");
  });

  it("handles PIPE, PUMP, VALVE keywords as link types", () => {
    const resolver = createResolver({ PIPE1: 1, PUMP1: 2, VALVE1: 3 });
    const text = `PIPE PIPE1 OPEN AT TIME 1
PUMP PUMP1 OPEN AT TIME 2
VALVE VALVE1 OPEN AT TIME 3`;

    const result = parseSimpleControlsFromText(text, resolver);

    expect(result).toHaveLength(3);
    expect(result[0].assetReferences[0].assetId).toBe(1);
    expect(result[1].assetReferences[0].assetId).toBe(2);
    expect(result[2].assetReferences[0].assetId).toBe(3);
  });

  describe("flexible keywords", () => {
    it("parses control with custom keywords (non-standard words)", () => {
      const resolver = createResolver({ P1: 1, T1: 2 });
      const text = "ELEMENTO P1 OPEN IF NODO T1 ABOVE 100";

      const result = parseSimpleControlsFromText(text, resolver);

      expect(result).toHaveLength(1);
      expect(result[0].template).toBe(
        "ELEMENTO {{0}} OPEN IF NODO {{1}} ABOVE 100",
      );
      expect(result[0].assetReferences).toHaveLength(2);
      expect(result[0].assetReferences[0].assetId).toBe(1);
      expect(result[0].assetReferences[0].isActionTarget).toBe(true);
      expect(result[0].assetReferences[1].assetId).toBe(2);
      expect(result[0].assetReferences[1].isActionTarget).toBe(false);
    });

    it("parses AT TIME control with custom keyword", () => {
      const resolver = createResolver({ PUMP1: 1 });
      const text = "X PUMP1 1.5 AT TIME 16";

      const result = parseSimpleControlsFromText(text, resolver);

      expect(result).toHaveLength(1);
      expect(result[0].template).toBe("X {{0}} 1.5 AT TIME 16");
      expect(result[0].assetReferences).toHaveLength(1);
      expect(result[0].assetReferences[0].assetId).toBe(1);
      expect(result[0].assetReferences[0].isActionTarget).toBe(true);
    });

    it("preserves original custom keyword in template", () => {
      const resolver = createResolver({ P1: 1, T1: 2 });
      const text = "TUBERIA P1 CLOSED IF TANQUE T1 BELOW 50";

      const result = parseSimpleControlsFromText(text, resolver);

      expect(result[0].template).toBe(
        "TUBERIA {{0}} CLOSED IF TANQUE {{1}} BELOW 50",
      );
    });

    it("handles partial resolution - link resolves but node does not", () => {
      const resolver = createResolver({ P1: 1 });
      const text = "FOO P1 OPEN IF BAR UNKNOWN_NODE ABOVE 100";

      const result = parseSimpleControlsFromText(text, resolver);

      expect(result).toHaveLength(1);
      expect(result[0].template).toBe(
        "FOO {{0}} OPEN IF BAR UNKNOWN_NODE ABOVE 100",
      );
      expect(result[0].assetReferences).toHaveLength(1);
      expect(result[0].assetReferences[0].assetId).toBe(1);
    });

    it("returns original line with empty refs when link does not resolve", () => {
      const resolver = createResolver({ T1: 2 });
      const text = "FOO UNKNOWN_LINK OPEN IF BAR T1 ABOVE 100";

      const result = parseSimpleControlsFromText(text, resolver);

      expect(result).toHaveLength(1);
      expect(result[0].template).toBe(
        "FOO UNKNOWN_LINK OPEN IF BAR T1 ABOVE 100",
      );
      expect(result[0].assetReferences).toHaveLength(0);
    });
  });

  describe("invalid input handling", () => {
    it("handles random text without crashing", () => {
      const resolver = createResolver({});
      const text = "hello world this is not a valid control";

      const result = parseSimpleControlsFromText(text, resolver);

      expect(result).toHaveLength(1);
      expect(result[0].template).toBe(
        "hello world this is not a valid control",
      );
      expect(result[0].assetReferences).toHaveLength(0);
    });

    it("handles special characters without crashing", () => {
      const resolver = createResolver({});
      const text = '!@#$%^&*()[]{}|\\:";<>?,./~`';

      const result = parseSimpleControlsFromText(text, resolver);

      expect(result).toHaveLength(1);
      expect(result[0].assetReferences).toHaveLength(0);
    });

    it("handles incomplete control syntax", () => {
      const resolver = createResolver({ P1: 1 });
      const text = "LINK P1";

      const result = parseSimpleControlsFromText(text, resolver);

      expect(result).toHaveLength(1);
      expect(result[0].template).toBe("LINK {{0}}");
      expect(result[0].assetReferences).toHaveLength(1);
    });

    it("handles very long lines", () => {
      const resolver = createResolver({});
      const text = "a".repeat(10000);

      const result = parseSimpleControlsFromText(text, resolver);

      expect(result).toHaveLength(1);
    });

    it("handles unicode characters", () => {
      const resolver = createResolver({});
      const text = "LINK 管道1 OPEN IF NODE 水箱 ABOVE 100";

      const result = parseSimpleControlsFromText(text, resolver);

      expect(result).toHaveLength(1);
    });

    it("handles mixed valid and invalid lines", () => {
      const resolver = createResolver({ P1: 1, T1: 2 });
      const text = `random garbage
LINK P1 OPEN IF NODE T1 ABOVE 100
more nonsense here`;

      const result = parseSimpleControlsFromText(text, resolver);

      expect(result).toHaveLength(3);
      expect(result[1].assetReferences).toHaveLength(2);
    });
  });
});

describe("parseRulesFromText", () => {
  const createResolver = (mapping: Record<string, number>): LabelResolver => {
    return (_keyword, label) => mapping[label.toUpperCase()];
  };

  it("parses empty text", () => {
    const result = parseRulesFromText("", createResolver({}));
    expect(result).toEqual([]);
  });

  it("parses single rule", () => {
    const resolver = createResolver({ T1: 1, P1: 2 });
    const text = `RULE 1
IF NODE T1 LEVEL > 100
THEN LINK P1 STATUS IS OPEN`;

    const result = parseRulesFromText(text, resolver);

    expect(result).toHaveLength(1);
    expect(result[0].ruleId).toBe("1");
    expect(result[0].template).toBe(`RULE {{id}}
IF NODE {{0}} LEVEL > 100
THEN LINK {{1}} STATUS IS OPEN`);
    expect(result[0].assetReferences).toHaveLength(2);
    expect(result[0].assetReferences[0].assetId).toBe(1);
    expect(result[0].assetReferences[0].isActionTarget).toBe(false);
    expect(result[0].assetReferences[1].assetId).toBe(2);
    expect(result[0].assetReferences[1].isActionTarget).toBe(true);
  });

  it("parses multiple rules", () => {
    const resolver = createResolver({ T1: 1, P1: 2 });
    const text = `RULE TankHigh
IF NODE T1 LEVEL > 100
THEN LINK P1 STATUS IS OPEN

RULE TankLow
IF NODE T1 LEVEL < 50
THEN LINK P1 STATUS IS CLOSED`;

    const result = parseRulesFromText(text, resolver);

    expect(result).toHaveLength(2);
    expect(result[0].ruleId).toBe("TankHigh");
    expect(result[1].ruleId).toBe("TankLow");
  });

  it("marks assets after THEN as action targets", () => {
    const resolver = createResolver({ T1: 1, P1: 2 });
    const text = `RULE 1
IF NODE T1 LEVEL > 100
THEN LINK P1 STATUS IS OPEN`;

    const result = parseRulesFromText(text, resolver);

    expect(result[0].assetReferences[0].isActionTarget).toBe(false); // T1 in condition
    expect(result[0].assetReferences[1].isActionTarget).toBe(true); // P1 in action
  });

  it("marks assets after ELSE as action targets", () => {
    const resolver = createResolver({ T1: 1, P1: 2, P2: 3 });
    const text = `RULE 1
IF NODE T1 LEVEL > 100
THEN LINK P1 STATUS IS OPEN
ELSE LINK P2 STATUS IS CLOSED`;

    const result = parseRulesFromText(text, resolver);

    expect(result[0].assetReferences[0].isActionTarget).toBe(false); // T1
    expect(result[0].assetReferences[1].isActionTarget).toBe(true); // P1
    expect(result[0].assetReferences[2].isActionTarget).toBe(true); // P2
  });

  it("marks assets after AND (in action clause) as action targets", () => {
    const resolver = createResolver({ T1: 1, P1: 2, P2: 3 });
    const text = `RULE 1
IF NODE T1 LEVEL > 100
THEN LINK P1 STATUS IS OPEN
AND LINK P2 STATUS IS OPEN`;

    const result = parseRulesFromText(text, resolver);

    expect(result[0].assetReferences[1].isActionTarget).toBe(true); // P1
    expect(result[0].assetReferences[2].isActionTarget).toBe(true); // P2
  });

  it("preserves inline comments", () => {
    const resolver = createResolver({ T1: 1, P1: 2 });
    const text = `RULE 1 ;main control
IF NODE T1 LEVEL > 100
THEN LINK P1 STATUS IS OPEN ;activate pump`;

    const result = parseRulesFromText(text, resolver);

    expect(result[0].template).toContain(";main control");
    expect(result[0].template).toContain(";activate pump");
  });

  it("handles rule ID with special characters", () => {
    const resolver = createResolver({ T1: 1, P1: 2 });
    const text = `RULE Tank-Control_1
IF NODE T1 LEVEL > 100
THEN LINK P1 STATUS IS OPEN`;

    const result = parseRulesFromText(text, resolver);

    expect(result[0].ruleId).toBe("Tank-Control_1");
  });

  describe("invalid input handling", () => {
    it("handles random text without crashing", () => {
      const resolver = createResolver({});
      const text = "hello world this is not a valid rule";

      const result = parseRulesFromText(text, resolver);

      expect(result).toHaveLength(1);
      expect(result[0].ruleId).toBe("");
      expect(result[0].assetReferences).toHaveLength(0);
    });

    it("handles special characters without crashing", () => {
      const resolver = createResolver({});
      const text = '!@#$%^&*()[]{}|\\:";<>?,./~`';

      const result = parseRulesFromText(text, resolver);

      expect(result).toHaveLength(1);
    });

    it("handles RULE keyword without ID", () => {
      const resolver = createResolver({});
      const text = "RULE\nIF something\nTHEN something";

      const result = parseRulesFromText(text, resolver);

      expect(result).toHaveLength(1);
      expect(result[0].ruleId).toBe("");
    });

    it("handles rule without THEN clause", () => {
      const resolver = createResolver({ T1: 1 });
      const text = `RULE 1
IF NODE T1 LEVEL > 100`;

      const result = parseRulesFromText(text, resolver);

      expect(result).toHaveLength(1);
      expect(result[0].assetReferences[0].isActionTarget).toBe(false);
    });

    it("handles very long rule text", () => {
      const resolver = createResolver({});
      const text = `RULE 1\n${"IF something\n".repeat(1000)}THEN something`;

      const result = parseRulesFromText(text, resolver);

      expect(result).toHaveLength(1);
    });

    it("handles unicode characters", () => {
      const resolver = createResolver({});
      const text = `RULE 规则1
IF NODE 水箱 LEVEL > 100
THEN LINK 管道 STATUS IS OPEN`;

      const result = parseRulesFromText(text, resolver);

      expect(result).toHaveLength(1);
      expect(result[0].ruleId).toBe("规则1");
    });

    it("handles text that looks like multiple rules but is garbage", () => {
      const resolver = createResolver({});
      const text = `not a rule
RULE
more garbage
RULE without proper format`;

      const result = parseRulesFromText(text, resolver);

      // Should split on RULE keyword
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe("parseControlsFromText", () => {
  it("parses both simple controls and rules from AssetsMap", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1" })
      .aTank(2, { label: "T1" })
      .aPipe(3, { startNodeId: 1, endNodeId: 2, label: "P1" })
      .build();

    const simpleText = "LINK P1 OPEN IF NODE T1 ABOVE 100";
    const rulesText = `RULE 1
IF NODE T1 LEVEL > 100
THEN LINK P1 STATUS IS OPEN`;

    const result = parseControlsFromText(simpleText, rulesText, model.assets);

    expect(result.simple).toHaveLength(1);
    expect(result.rules).toHaveLength(1);
    expect(result.simple[0].assetReferences[0].assetId).toBe(3); // P1
    expect(result.simple[0].assetReferences[1].assetId).toBe(2); // T1
    expect(result.rules[0].assetReferences[0].assetId).toBe(2); // T1
    expect(result.rules[0].assetReferences[1].assetId).toBe(3); // P1
  });

  it("handles empty inputs", () => {
    const model = HydraulicModelBuilder.with().aJunction(1).build();

    const result = parseControlsFromText("", "", model.assets);

    expect(result.simple).toEqual([]);
    expect(result.rules).toEqual([]);
  });
});

describe("createLabelResolverFromAssets", () => {
  it("resolves link labels", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1)
      .aJunction(2)
      .aPipe(3, { startNodeId: 1, endNodeId: 2, label: "MainPipe" })
      .build();

    const resolver = createLabelResolverFromAssets(model.assets);

    expect(resolver("link", "MainPipe")).toBe(3);
  });

  it("resolves node labels", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { label: "Junction1" })
      .aTank(2, { label: "Tank1" })
      .build();

    const resolver = createLabelResolverFromAssets(model.assets);

    expect(resolver("node", "Junction1")).toBe(1);
    expect(resolver("node", "Tank1")).toBe(2);
  });

  it("is case-insensitive for labels", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { label: "MyJunction" })
      .build();

    const resolver = createLabelResolverFromAssets(model.assets);

    expect(resolver("node", "myjunction")).toBe(1);
    expect(resolver("node", "MYJUNCTION")).toBe(1);
    expect(resolver("node", "MyJunction")).toBe(1);
  });

  it("returns undefined for unknown labels", () => {
    const model = HydraulicModelBuilder.with().aJunction(1).build();

    const resolver = createLabelResolverFromAssets(model.assets);

    expect(resolver("node", "UnknownNode")).toBeUndefined();
    expect(resolver("link", "UnknownLink")).toBeUndefined();
  });
});
