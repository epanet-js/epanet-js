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

    const cp1 = hydraulicModel.customerPoints.get("CP1");
    expect(cp1).toBeDefined();
    expect(cp1?.coordinates).toEqual([1.5, 2.5]);
    expect(cp1?.baseDemand).toBe(2.5);
    const pipe = getByLabel(hydraulicModel.assets, "P1") as Pipe;
    const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
    expect(pipe).toBeDefined();
    expect(junction).toBeDefined();
    expect(cp1?.connection?.pipeId).toBe(pipe.id);
    expect(cp1?.connection?.junctionId).toBe(junction.id);
    expect(cp1?.connection?.snapPoint).toEqual([1.2, 2.2]);

    const cp2 = hydraulicModel.customerPoints.get("CP2");
    expect(cp2).toBeDefined();
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
    expect(hydraulicModel.customerPoints.has("CP1")).toBe(true);
    expect(hydraulicModel.customerPoints.has("CP2")).toBe(true);
  });

  it("integrates customer points with lookup system", () => {
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
    expect([...connectedToP1][0].id).toBe("CP1");
    expect([...connectedToJ1][0].id).toBe("CP1");
  });

  it("resolves junction labels to actual junction IDs", () => {
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

    const cp1 = hydraulicModel.customerPoints.get("CP1");
    expect(cp1).toBeDefined();
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
