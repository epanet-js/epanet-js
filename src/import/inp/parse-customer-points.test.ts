import { Junction, Pipe } from "src/hydraulic-model";
import { parseInp } from "./parse-inp";
import { getByLabel } from "src/__helpers__/asset-queries";
import { checksum } from "src/infra/checksum";

// Helper to create valid app-made INP with customer points
const createAppMadeInpWithCustomerPoints = (
  baseContent: string,
  customerPointsSection: string,
): string => {
  const contentWithCustomerPoints = baseContent + "\n" + customerPointsSection;
  const checksumValue = checksum(contentWithCustomerPoints);
  return `;MADE BY EPANET-JS [${checksumValue}]\n${contentWithCustomerPoints}`;
};

describe("Parse customer points", () => {
  it("parses customer points when option is enabled and INP made by app", () => {
    const IDS = { CP1: 1, CP2: 2 } as const;

    const baseContent = `[JUNCTIONS]
J1	10
J2	20

[PIPES]
P1	J1	J2	100	300	130	0	Open

[COORDINATES]
J1	1	2
J2	3	4

[END]`;

    const customerPointsSection = `;[CUSTOMERS]
;Id	X-coord	Y-coord	BaseDemand	PipeId	JunctionId	SnapX	SnapY
;CP1	1.5	2.5	2.5	P1	J1	1.2	2.2
;CP2	5	6	1.8`;

    const validAppInp = createAppMadeInpWithCustomerPoints(
      baseContent,
      customerPointsSection,
    );

    const { hydraulicModel, isMadeByApp } = parseInp(validAppInp, {
      customerPoints: true,
    });

    expect(isMadeByApp).toBe(true);
    expect(hydraulicModel.customerPoints.size).toBe(2);

    const cp1 = hydraulicModel.customerPoints.get(IDS.CP1);
    expect(cp1).toBeDefined();
    expect(cp1?.label).toBe("CP1");
    expect(cp1?.coordinates).toEqual([1.5, 2.5]);
    expect(cp1?.baseDemand).toBe(2.5);
    const pipe = getByLabel(hydraulicModel.assets, "P1") as Pipe;
    const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
    expect(pipe).toBeDefined();
    expect(junction).toBeDefined();
    expect(cp1?.connection?.pipeId).toBe(pipe.id);
    expect(cp1?.connection?.junctionId).toBe(junction.id);
    expect(cp1?.connection?.snapPoint).toEqual([1.2, 2.2]);

    const cp2 = hydraulicModel.customerPoints.get(IDS.CP2);
    expect(cp2).toBeDefined();
    expect(cp2?.label).toBe("CP2");
    expect(cp2?.coordinates).toEqual([5, 6]);
    expect(cp2?.baseDemand).toBe(1.8);
    expect(cp2?.connection).toBeNull();
  });

  it("ignores customer points when option is disabled", () => {
    const baseContent = `[JUNCTIONS]
J1	10

[COORDINATES]
J1	1	2

[END]`;

    const customerPointsSection = `;[CUSTOMERS]
;CP1	1.5	2.5	2.5`;

    const validAppInp = createAppMadeInpWithCustomerPoints(
      baseContent,
      customerPointsSection,
    );

    const { hydraulicModel } = parseInp(validAppInp, { customerPoints: false });

    expect(hydraulicModel.customerPoints.size).toBe(0);
  });

  it("ignores customer points by default", () => {
    const baseContent = `[JUNCTIONS]
J1	10

[COORDINATES]
J1	1	2

[END]`;

    const customerPointsSection = `;[CUSTOMERS]
;CP1	1.5	2.5	2.5`;

    const validAppInp = createAppMadeInpWithCustomerPoints(
      baseContent,
      customerPointsSection,
    );

    const { hydraulicModel } = parseInp(validAppInp);

    expect(hydraulicModel.customerPoints.size).toBe(0);
  });

  it("handles empty customer points section", () => {
    const baseContent = `[JUNCTIONS]
J1	10

[COORDINATES]
J1	1	2

[END]`;

    const customerPointsSection = `;[CUSTOMERS]
;Id	X-coord	Y-coord	BaseDemand`;

    const validAppInp = createAppMadeInpWithCustomerPoints(
      baseContent,
      customerPointsSection,
    );

    const { hydraulicModel } = parseInp(validAppInp, { customerPoints: true });

    expect(hydraulicModel.customerPoints.size).toBe(0);
  });

  it("skips malformed customer point lines", () => {
    const IDS = { CP1: 1, CP2: 2 } as const;

    const baseContent = `[JUNCTIONS]
J1	10

[COORDINATES]
J1	1	2

[END]`;

    const customerPointsSection = `;[CUSTOMERS]
;CP1	1.5	2.5	2.5
;INVALID_LINE_MISSING_DATA
;CP2	5	6	1.8`;

    const validAppInp = createAppMadeInpWithCustomerPoints(
      baseContent,
      customerPointsSection,
    );

    const { hydraulicModel } = parseInp(validAppInp, { customerPoints: true });

    expect(hydraulicModel.customerPoints.size).toBe(2);
    expect(hydraulicModel.customerPoints.has(IDS.CP1)).toBe(true);
    expect(hydraulicModel.customerPoints.has(IDS.CP2)).toBe(true);
  });

  it("integrates customer points with lookup system", () => {
    const IDS = { CP1: 1 } as const;

    const baseContent = `[JUNCTIONS]
J1	10

[PIPES]
P1	J1	J1	100	300	130	0	Open

[COORDINATES]
J1	1	2

[END]`;

    const customerPointsSection = `;[CUSTOMERS]
;CP1	1.5	2.5	2.5	P1	J1	1.2	2.2`;

    const validAppInp = createAppMadeInpWithCustomerPoints(
      baseContent,
      customerPointsSection,
    );

    const { hydraulicModel } = parseInp(validAppInp, { customerPoints: true });

    const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
    const pipe = getByLabel(hydraulicModel.assets, "P1") as Pipe;

    const connectedToP1 = hydraulicModel.customerPointsLookup.getCustomerPoints(
      pipe.id,
    );
    const connectedToJ1 = hydraulicModel.customerPointsLookup.getCustomerPoints(
      junction.id,
    );

    expect(connectedToP1.size).toBe(1);
    expect(connectedToJ1.size).toBe(1);
    expect([...connectedToP1][0].id).toBe(IDS.CP1);
    expect([...connectedToJ1][0].id).toBe(IDS.CP1);
    expect([...connectedToP1][0].label).toBe("CP1");
    expect([...connectedToJ1][0].label).toBe("CP1");
  });

  it("resolves junction labels to actual junction IDs", () => {
    const IDS = { CP1: 1 } as const;

    const baseContent = `[JUNCTIONS]
Junction-A	10
Junction-B	20

[PIPES]
Pipe-1	Junction-A	Junction-B	100	300	130	0	Open

[COORDINATES]
Junction-A	1	2
Junction-B	3	4

[END]`;

    const customerPointsSection = `;[CUSTOMERS]
;CP1	1.5	2.5	2.5	Pipe-1	Junction-A	1.2	2.2`;

    const validAppInp = createAppMadeInpWithCustomerPoints(
      baseContent,
      customerPointsSection,
    );

    const { hydraulicModel } = parseInp(validAppInp, { customerPoints: true });

    const cp1 = hydraulicModel.customerPoints.get(IDS.CP1);
    expect(cp1).toBeDefined();
    expect(cp1?.label).toBe("CP1");
    expect(cp1?.connection).toBeDefined();

    const junction = getByLabel(
      hydraulicModel.assets,
      "Junction-A",
    ) as Junction;
    expect(junction).toBeDefined();
    expect(cp1?.connection?.junctionId).toBe(junction.id);
  });

  it("ignores customer points when INP was not made by app", () => {
    const inp = `
    [JUNCTIONS]
    J1	10

    [COORDINATES]
    J1	1	2

    ;[CUSTOMERS]
    ;Id	X-coord	Y-coord	BaseDemand	PipeId	JunctionId	SnapX	SnapY
    ;CP1	1.5	2.5	2.5
    `;

    const { hydraulicModel, isMadeByApp } = parseInp(inp, {
      customerPoints: true,
    });

    expect(isMadeByApp).toBe(false);
    expect(hydraulicModel.customerPoints.size).toBe(0);
  });
});

describe("Parse customer demands", () => {
  it("parses customer demands from CUSTOMERS_DEMANDS section", () => {
    const IDS = { CP1: 1 } as const;

    const baseContent = `[JUNCTIONS]
J1	10

[PIPES]
P1	J1	J1	100	300	130	0	Open

[PATTERNS]
residential	1	1.2	0.8

[COORDINATES]
J1	1	2

[END]`;

    const customerPointsSection = `;[CUSTOMERS]
;Id	X-coord	Y-coord	BaseDemand	PipeId	JunctionId	SnapX	SnapY
;CP1	1.5	2.5	0	P1	J1	1.2	2.2

;[CUSTOMERS_DEMANDS]
;Label	BaseDemand	PatternId
;CP1	25	residential`;

    const validAppInp = createAppMadeInpWithCustomerPoints(
      baseContent,
      customerPointsSection,
    );

    const { hydraulicModel } = parseInp(validAppInp, { customerPoints: true });

    const cp1 = hydraulicModel.customerPoints.get(IDS.CP1);
    expect(cp1).toBeDefined();
    expect(cp1?.demands).toHaveLength(1);
    expect(cp1?.demands[0].baseDemand).toBe(25);
    expect(cp1?.demands[0].patternLabel).toBe("residential");
  });

  it("parses multiple demands per customer point", () => {
    const IDS = { CP1: 1 } as const;

    const baseContent = `[JUNCTIONS]
J1	10

[PIPES]
P1	J1	J1	100	300	130	0	Open

[PATTERNS]
residential	1	1.2	0.8
commercial	0.5	1.5	1.0

[COORDINATES]
J1	1	2

[END]`;

    const customerPointsSection = `;[CUSTOMERS]
;Id	X-coord	Y-coord	BaseDemand	PipeId	JunctionId	SnapX	SnapY
;CP1	1.5	2.5	0	P1	J1	1.2	2.2

;[CUSTOMERS_DEMANDS]
;Label	BaseDemand	PatternId
;CP1	25	residential
;CP1	15	commercial`;

    const validAppInp = createAppMadeInpWithCustomerPoints(
      baseContent,
      customerPointsSection,
    );

    const { hydraulicModel } = parseInp(validAppInp, { customerPoints: true });

    const cp1 = hydraulicModel.customerPoints.get(IDS.CP1);
    expect(cp1).toBeDefined();
    expect(cp1?.demands).toHaveLength(2);
    expect(cp1?.demands[0].baseDemand).toBe(25);
    expect(cp1?.demands[0].patternLabel).toBe("residential");
    expect(cp1?.demands[1].baseDemand).toBe(15);
    expect(cp1?.demands[1].patternLabel).toBe("commercial");
  });

  it("parses customer demands without pattern", () => {
    const IDS = { CP1: 1 } as const;

    const baseContent = `[JUNCTIONS]
J1	10

[PIPES]
P1	J1	J1	100	300	130	0	Open

[COORDINATES]
J1	1	2

[END]`;

    const customerPointsSection = `;[CUSTOMERS]
;Id	X-coord	Y-coord	BaseDemand	PipeId	JunctionId	SnapX	SnapY
;CP1	1.5	2.5	0	P1	J1	1.2	2.2

;[CUSTOMERS_DEMANDS]
;Label	BaseDemand	PatternId
;CP1	30`;

    const validAppInp = createAppMadeInpWithCustomerPoints(
      baseContent,
      customerPointsSection,
    );

    const { hydraulicModel } = parseInp(validAppInp, { customerPoints: true });

    const cp1 = hydraulicModel.customerPoints.get(IDS.CP1);
    expect(cp1).toBeDefined();
    expect(cp1?.demands).toHaveLength(1);
    expect(cp1?.demands[0].baseDemand).toBe(30);
    expect(cp1?.demands[0].patternLabel).toBeUndefined();
  });

  it("falls back to baseDemand when no CUSTOMERS_DEMANDS section exists", () => {
    const IDS = { CP1: 1 } as const;

    const baseContent = `[JUNCTIONS]
J1	10

[PIPES]
P1	J1	J1	100	300	130	0	Open

[COORDINATES]
J1	1	2

[END]`;

    const customerPointsSection = `;[CUSTOMERS]
;Id	X-coord	Y-coord	BaseDemand	PipeId	JunctionId	SnapX	SnapY
;CP1	1.5	2.5	42	P1	J1	1.2	2.2`;

    const validAppInp = createAppMadeInpWithCustomerPoints(
      baseContent,
      customerPointsSection,
    );

    const { hydraulicModel } = parseInp(validAppInp, { customerPoints: true });

    const cp1 = hydraulicModel.customerPoints.get(IDS.CP1);
    expect(cp1).toBeDefined();
    expect(cp1?.baseDemand).toBe(42);
    expect(cp1?.demands).toHaveLength(1);
    expect(cp1?.demands[0].baseDemand).toBe(42);
    expect(cp1?.demands[0].patternLabel).toBeUndefined();
  });

  it("parses demands for multiple customer points", () => {
    const IDS = { CP1: 1, CP2: 2 } as const;

    const baseContent = `[JUNCTIONS]
J1	10

[PIPES]
P1	J1	J1	100	300	130	0	Open

[PATTERNS]
residential	1	1.2	0.8
commercial	0.5	1.5	1.0

[COORDINATES]
J1	1	2

[END]`;

    const customerPointsSection = `;[CUSTOMERS]
;Id	X-coord	Y-coord	BaseDemand	PipeId	JunctionId	SnapX	SnapY
;CP1	1.5	2.5	0	P1	J1	1.2	2.2
;CP2	3	4	0	P1	J1	2.5	3.5

;[CUSTOMERS_DEMANDS]
;Label	BaseDemand	PatternId
;CP1	25	residential
;CP2	15	commercial`;

    const validAppInp = createAppMadeInpWithCustomerPoints(
      baseContent,
      customerPointsSection,
    );

    const { hydraulicModel } = parseInp(validAppInp, { customerPoints: true });

    const cp1 = hydraulicModel.customerPoints.get(IDS.CP1);
    expect(cp1?.demands).toHaveLength(1);
    expect(cp1?.demands[0].baseDemand).toBe(25);
    expect(cp1?.demands[0].patternLabel).toBe("residential");

    const cp2 = hydraulicModel.customerPoints.get(IDS.CP2);
    expect(cp2?.demands).toHaveLength(1);
    expect(cp2?.demands[0].baseDemand).toBe(15);
    expect(cp2?.demands[0].patternLabel).toBe("commercial");
  });

  it("ignores CUSTOMERS_DEMANDS section when customerPoints option is false", () => {
    const baseContent = `[JUNCTIONS]
J1	10

[COORDINATES]
J1	1	2

[END]`;

    const customerPointsSection = `;[CUSTOMERS]
;CP1	1.5	2.5	0

;[CUSTOMERS_DEMANDS]
;CP1	25	residential`;

    const validAppInp = createAppMadeInpWithCustomerPoints(
      baseContent,
      customerPointsSection,
    );

    const { hydraulicModel } = parseInp(validAppInp, { customerPoints: false });

    expect(hydraulicModel.customerPoints.size).toBe(0);
  });

  it("skips malformed customer demand lines", () => {
    const IDS = { CP1: 1 } as const;

    const baseContent = `[JUNCTIONS]
J1	10

[PIPES]
P1	J1	J1	100	300	130	0	Open

[COORDINATES]
J1	1	2

[END]`;

    const customerPointsSection = `;[CUSTOMERS]
;Id	X-coord	Y-coord	BaseDemand	PipeId	JunctionId	SnapX	SnapY
;CP1	1.5	2.5	0	P1	J1	1.2	2.2

;[CUSTOMERS_DEMANDS]
;Label	BaseDemand	PatternId
;MISSING_DEMAND
;CP1	25`;

    const validAppInp = createAppMadeInpWithCustomerPoints(
      baseContent,
      customerPointsSection,
    );

    const { hydraulicModel } = parseInp(validAppInp, { customerPoints: true });

    const cp1 = hydraulicModel.customerPoints.get(IDS.CP1);
    expect(cp1?.demands).toHaveLength(1);
    expect(cp1?.demands[0].baseDemand).toBe(25);
  });
});
