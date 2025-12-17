import { parseInpWithControls } from "./parse-inp-with-controls";

describe("Parse CONTROLS and RULES sections", () => {
  describe("CONTROLS section parsing", () => {
    it("parses empty CONTROLS section", () => {
      const inp = `
      [CONTROLS]

      [END]
      `;

      const { hydraulicModel } = parseInpWithControls(inp);

      expect(hydraulicModel.controls.simple).toEqual("");
      expect(hydraulicModel.controls.ruleBased).toEqual("");
    });

    it("parses single line CONTROLS section", () => {
      const inp = `
      [CONTROLS]
      LINK P1 OPEN IF NODE T1 ABOVE 100

      [END]
      `;

      const { hydraulicModel } = parseInpWithControls(inp);

      expect(hydraulicModel.controls.simple).toEqual(
        "LINK P1 OPEN IF NODE T1 ABOVE 100",
      );
    });

    it("parses multi-line CONTROLS section", () => {
      const inp = `
      [CONTROLS]
      LINK P1 OPEN IF NODE T1 ABOVE 100
      LINK P1 CLOSED IF NODE T1 BELOW 50
      LINK PUMP1 OPEN AT TIME 6

      [END]
      `;

      const { hydraulicModel } = parseInpWithControls(inp);

      expect(hydraulicModel.controls.simple).toEqual(
        "LINK P1 OPEN IF NODE T1 ABOVE 100\n" +
          "LINK P1 CLOSED IF NODE T1 BELOW 50\n" +
          "LINK PUMP1 OPEN AT TIME 6",
      );
    });

    it("preserves controls with special characters", () => {
      const inp = `
      [CONTROLS]
      LINK P-1 OPEN IF NODE T_1 ABOVE 100.5

      [END]
      `;

      const { hydraulicModel } = parseInpWithControls(inp);

      expect(hydraulicModel.controls.simple).toEqual(
        "LINK P-1 OPEN IF NODE T_1 ABOVE 100.5",
      );
    });
  });

  describe("RULES section parsing", () => {
    it("parses empty RULES section", () => {
      const inp = `
      [RULES]

      [END]
      `;

      const { hydraulicModel } = parseInpWithControls(inp);

      expect(hydraulicModel.controls.simple).toEqual("");
      expect(hydraulicModel.controls.ruleBased).toEqual("");
    });

    it("parses single RULES section", () => {
      const inp = `
      [RULES]
      RULE 1
      IF NODE T1 LEVEL > 100
      THEN LINK P1 STATUS IS OPEN

      [END]
      `;

      const { hydraulicModel } = parseInpWithControls(inp);

      expect(hydraulicModel.controls.ruleBased).toEqual(
        "RULE 1\n" + "IF NODE T1 LEVEL > 100\n" + "THEN LINK P1 STATUS IS OPEN",
      );
    });

    it("parses multi-rule RULES section", () => {
      const inp = `
      [RULES]
      RULE 1
      IF NODE T1 LEVEL > 100
      THEN LINK P1 STATUS IS OPEN

      RULE 2
      IF NODE T1 LEVEL < 50
      THEN LINK P1 STATUS IS CLOSED

      [END]
      `;

      const { hydraulicModel } = parseInpWithControls(inp);

      expect(hydraulicModel.controls.ruleBased).toContain("RULE 1");
      expect(hydraulicModel.controls.ruleBased).toContain("RULE 2");
      expect(hydraulicModel.controls.ruleBased).toContain(
        "THEN LINK P1 STATUS IS OPEN",
      );
      expect(hydraulicModel.controls.ruleBased).toContain(
        "THEN LINK P1 STATUS IS CLOSED",
      );
    });
  });

  describe("CONTROLS and RULES together", () => {
    it("parses both CONTROLS and RULES sections", () => {
      const inp = `
      [CONTROLS]
      LINK P1 OPEN IF NODE T1 ABOVE 100

      [RULES]
      RULE 1
      IF NODE T1 LEVEL > 100
      THEN LINK P2 STATUS IS OPEN

      [END]
      `;

      const { hydraulicModel } = parseInpWithControls(inp);

      expect(hydraulicModel.controls.simple).toEqual(
        "LINK P1 OPEN IF NODE T1 ABOVE 100",
      );
      expect(hydraulicModel.controls.ruleBased).toContain("RULE 1");
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

      const { hydraulicModel } = parseInpWithControls(inp);

      expect(hydraulicModel.assets.size).toEqual(3);
      expect(hydraulicModel.controls.simple).toContain("LINK 3 CLOSED");
      expect(hydraulicModel.controls.ruleBased).toContain("RULE 1");
    });

    it("preserves inline comments in CONTROLS", () => {
      const inp = `
      [CONTROLS]
      LINK P1 OPEN IF NODE T1 ABOVE 100 ;open when tank is full

      [END]
      `;

      const { hydraulicModel } = parseInpWithControls(inp);

      expect(hydraulicModel.controls.simple).toEqual(
        "LINK P1 OPEN IF NODE T1 ABOVE 100 ;open when tank is full",
      );
    });

    it("preserves inline comments in RULES", () => {
      const inp = `
      [RULES]
      RULE 1 ;main tank control
      IF NODE T1 LEVEL > 100
      THEN LINK P1 STATUS IS OPEN ;activate pump

      [END]
      `;

      const { hydraulicModel } = parseInpWithControls(inp);

      expect(hydraulicModel.controls.ruleBased).toContain(";main tank control");
      expect(hydraulicModel.controls.ruleBased).toContain(";activate pump");
    });
  });
});
