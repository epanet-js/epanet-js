import { parseInp } from "./parse-inp";

describe("Parse CONTROLS and RULES sections", () => {
  describe("CONTROLS section parsing", () => {
    it("parses empty CONTROLS section", () => {
      const inp = `
      [CONTROLS]

      [END]
      `;

      const { hydraulicModel } = parseInp(inp);

      expect(hydraulicModel.controls.simple).toEqual([]);
      expect(hydraulicModel.controls.rules).toEqual([]);
    });

    it("parses single line CONTROLS section with resolvable assets", () => {
      const LABELS = { T1: "1", P1: "2", J1: "3" } as const;
      const inp = `
      [TANKS]
      ${LABELS.T1}\t50\t10\t0\t20\t50\t0

      [JUNCTIONS]
      ${LABELS.J1}\t50

      [PIPES]
      ${LABELS.P1}\t${LABELS.T1}\t${LABELS.J1}\t100\t100\t100\t0\tOpen

      [COORDINATES]
      ${LABELS.T1}\t1\t1
      ${LABELS.J1}\t2\t2

      [CONTROLS]
      LINK ${LABELS.P1} OPEN IF NODE ${LABELS.T1} ABOVE 100

      [END]
      `;

      const { hydraulicModel } = parseInp(inp);

      // Find assets by label
      const assets = [...hydraulicModel.assets.values()];
      const pipe = assets.find(
        (a) => a.feature.properties.label === LABELS.P1,
      )!;
      const tank = assets.find(
        (a) => a.feature.properties.label === LABELS.T1,
      )!;

      expect(hydraulicModel.controls.simple).toHaveLength(1);

      const control = hydraulicModel.controls.simple[0];
      expect(control.template).toBe("LINK {{0}} OPEN IF NODE {{1}} ABOVE 100");
      expect(control.assetReferences).toHaveLength(2);
      expect(control.assetReferences[0].assetId).toBe(pipe.id);
      expect(control.assetReferences[0].isActionTarget).toBe(true);
      expect(control.assetReferences[1].assetId).toBe(tank.id);
      expect(control.assetReferences[1].isActionTarget).toBe(false);
    });

    it("parses multi-line CONTROLS section", () => {
      const IDS = { T1: 1, P1: 2, J1: 3, PUMP1: 4 } as const;
      const inp = `
      [TANKS]
      ${IDS.T1}\t50\t10\t0\t20\t50\t0

      [JUNCTIONS]
      ${IDS.J1}\t50

      [PIPES]
      ${IDS.P1}\t${IDS.T1}\t${IDS.J1}\t100\t100\t100\t0\tOpen

      [PUMPS]
      ${IDS.PUMP1}\t${IDS.T1}\t${IDS.J1}\tPOWER 10

      [COORDINATES]
      ${IDS.T1}\t1\t1
      ${IDS.J1}\t2\t2

      [CONTROLS]
      LINK ${IDS.P1} OPEN IF NODE ${IDS.T1} ABOVE 100
      LINK ${IDS.P1} CLOSED IF NODE ${IDS.T1} BELOW 50
      LINK ${IDS.PUMP1} OPEN AT TIME 6

      [END]
      `;

      const { hydraulicModel } = parseInp(inp);

      expect(hydraulicModel.controls.simple).toHaveLength(3);

      expect(
        hydraulicModel.controls.simple[0].assetReferences[0].isActionTarget,
      ).toBe(true);
      expect(
        hydraulicModel.controls.simple[1].assetReferences[0].isActionTarget,
      ).toBe(true);
      expect(
        hydraulicModel.controls.simple[2].assetReferences[0].isActionTarget,
      ).toBe(true);
    });
  });

  describe("RULES section parsing", () => {
    it("parses empty RULES section", () => {
      const inp = `
      [RULES]

      [END]
      `;

      const { hydraulicModel } = parseInp(inp);

      expect(hydraulicModel.controls.simple).toEqual([]);
      expect(hydraulicModel.controls.rules).toEqual([]);
    });

    it("parses single RULES section with resolvable assets", () => {
      const LABELS = { T1: "1", P1: "2", J1: "3" } as const;
      const inp = `
      [TANKS]
      ${LABELS.T1}\t50\t10\t0\t20\t50\t0

      [JUNCTIONS]
      ${LABELS.J1}\t50

      [PIPES]
      ${LABELS.P1}\t${LABELS.T1}\t${LABELS.J1}\t100\t100\t100\t0\tOpen

      [COORDINATES]
      ${LABELS.T1}\t1\t1
      ${LABELS.J1}\t2\t2

      [RULES]
      RULE 1
      IF NODE ${LABELS.T1} LEVEL > 100
      THEN LINK ${LABELS.P1} STATUS IS OPEN

      [END]
      `;

      const { hydraulicModel } = parseInp(inp);

      const assets = [...hydraulicModel.assets.values()];
      const tank = assets.find(
        (a) => a.feature.properties.label === LABELS.T1,
      )!;
      const pipe = assets.find(
        (a) => a.feature.properties.label === LABELS.P1,
      )!;

      expect(hydraulicModel.controls.rules).toHaveLength(1);

      const rule = hydraulicModel.controls.rules[0];
      expect(rule.ruleId).toBe("1");
      expect(rule.template).toBe(`RULE {{id}}
IF NODE {{0}} LEVEL > 100
THEN LINK {{1}} STATUS IS OPEN`);

      expect(rule.assetReferences).toHaveLength(2);
      expect(rule.assetReferences[0].assetId).toBe(tank.id);
      expect(rule.assetReferences[0].isActionTarget).toBe(false);
      expect(rule.assetReferences[1].assetId).toBe(pipe.id);
      expect(rule.assetReferences[1].isActionTarget).toBe(true);
    });

    it("parses multi-rule RULES section", () => {
      const IDS = { T1: 1, P1: 2, J1: 3 } as const;
      const inp = `
      [TANKS]
      ${IDS.T1}\t50\t10\t0\t20\t50\t0

      [JUNCTIONS]
      ${IDS.J1}\t50

      [PIPES]
      ${IDS.P1}\t${IDS.T1}\t${IDS.J1}\t100\t100\t100\t0\tOpen

      [COORDINATES]
      ${IDS.T1}\t1\t1
      ${IDS.J1}\t2\t2

      [RULES]
      RULE 1
      IF NODE ${IDS.T1} LEVEL > 100
      THEN LINK ${IDS.P1} STATUS IS OPEN

      RULE 2
      IF NODE ${IDS.T1} LEVEL < 50
      THEN LINK ${IDS.P1} STATUS IS CLOSED

      [END]
      `;

      const { hydraulicModel } = parseInp(inp);

      expect(hydraulicModel.controls.rules).toHaveLength(2);
      expect(hydraulicModel.controls.rules[0].ruleId).toBe("1");
      expect(hydraulicModel.controls.rules[1].ruleId).toBe("2");
    });
  });

  describe("CONTROLS and RULES together", () => {
    it("parses both CONTROLS and RULES sections", () => {
      const IDS = { T1: 1, P1: 2, P2: 3, J1: 4 } as const;
      const inp = `
      [TANKS]
      ${IDS.T1}\t50\t10\t0\t20\t50\t0

      [JUNCTIONS]
      ${IDS.J1}\t50

      [PIPES]
      ${IDS.P1}\t${IDS.T1}\t${IDS.J1}\t100\t100\t100\t0\tOpen
      ${IDS.P2}\t${IDS.T1}\t${IDS.J1}\t100\t100\t100\t0\tOpen

      [COORDINATES]
      ${IDS.T1}\t1\t1
      ${IDS.J1}\t2\t2

      [CONTROLS]
      LINK ${IDS.P1} OPEN IF NODE ${IDS.T1} ABOVE 100

      [RULES]
      RULE 1
      IF NODE ${IDS.T1} LEVEL > 100
      THEN LINK ${IDS.P2} STATUS IS OPEN

      [END]
      `;

      const { hydraulicModel } = parseInp(inp);

      expect(hydraulicModel.controls.simple).toHaveLength(1);
      expect(hydraulicModel.controls.rules).toHaveLength(1);
    });

    it("parses controls alongside other sections", () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const inp = `
      [RESERVOIRS]
      ${IDS.R1}\t100

      [JUNCTIONS]
      ${IDS.J1}\t50

      [PIPES]
      ${IDS.P1}\t${IDS.R1}\t${IDS.J1}\t100\t100\t100\t0\tOpen

      [COORDINATES]
      ${IDS.R1}\t1\t1
      ${IDS.J1}\t2\t2

      [CONTROLS]
      LINK ${IDS.P1} CLOSED IF NODE ${IDS.R1} BELOW 80

      [RULES]
      RULE 1
      IF NODE ${IDS.R1} LEVEL < 90
      THEN LINK ${IDS.P1} STATUS IS CLOSED

      [END]
      `;

      const { hydraulicModel } = parseInp(inp);

      expect(hydraulicModel.assets.size).toEqual(3);
      expect(hydraulicModel.controls.simple).toHaveLength(1);
      expect(hydraulicModel.controls.rules).toHaveLength(1);

      expect(hydraulicModel.controls.simple[0].template).toContain("CLOSED");
      expect(hydraulicModel.controls.rules[0].template).toContain(
        "RULE {{id}}",
      );
      expect(hydraulicModel.controls.rules[0].ruleId).toBe("1");
    });

    it("preserves inline comments in CONTROLS", () => {
      const IDS = { T1: 1, P1: 2, J1: 3 } as const;
      const inp = `
      [TANKS]
      ${IDS.T1}\t50\t10\t0\t20\t50\t0

      [JUNCTIONS]
      ${IDS.J1}\t50

      [PIPES]
      ${IDS.P1}\t${IDS.T1}\t${IDS.J1}\t100\t100\t100\t0\tOpen

      [COORDINATES]
      ${IDS.T1}\t1\t1
      ${IDS.J1}\t2\t2

      [CONTROLS]
      LINK ${IDS.P1} OPEN IF NODE ${IDS.T1} ABOVE 100 ;open when tank is full

      [END]
      `;

      const { hydraulicModel } = parseInp(inp);

      expect(hydraulicModel.controls.simple[0].template).toContain(
        ";open when tank is full",
      );
    });

    it("preserves inline comments in RULES", () => {
      const IDS = { T1: 1, P1: 2, J1: 3 } as const;
      const inp = `
      [TANKS]
      ${IDS.T1}\t50\t10\t0\t20\t50\t0

      [JUNCTIONS]
      ${IDS.J1}\t50

      [PIPES]
      ${IDS.P1}\t${IDS.T1}\t${IDS.J1}\t100\t100\t100\t0\tOpen

      [COORDINATES]
      ${IDS.T1}\t1\t1
      ${IDS.J1}\t2\t2

      [RULES]
      RULE 1 ;main tank control
      IF NODE ${IDS.T1} LEVEL > 100
      THEN LINK ${IDS.P1} STATUS IS OPEN ;activate pump

      [END]
      `;

      const { hydraulicModel } = parseInp(inp);

      expect(hydraulicModel.controls.rules[0].template).toContain(
        ";main tank control",
      );
      expect(hydraulicModel.controls.rules[0].template).toContain(
        ";activate pump",
      );
    });

    it("preserves PRIORITY clause in template", () => {
      const IDS = { T1: 1, P1: 2, J1: 3 } as const;
      const inp = `
      [TANKS]
      ${IDS.T1}\t50\t10\t0\t20\t50\t0

      [JUNCTIONS]
      ${IDS.J1}\t50

      [PIPES]
      ${IDS.P1}\t${IDS.T1}\t${IDS.J1}\t100\t100\t100\t0\tOpen

      [COORDINATES]
      ${IDS.T1}\t1\t1
      ${IDS.J1}\t2\t2

      [RULES]
      RULE 1
      IF NODE ${IDS.T1} LEVEL > 100
      THEN LINK ${IDS.P1} STATUS IS OPEN
      PRIORITY 5

      [END]
      `;

      const { hydraulicModel } = parseInp(inp);

      expect(hydraulicModel.controls.rules[0].template).toContain("PRIORITY 5");
    });
  });
});
