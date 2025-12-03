import { parseInpWithEPS } from "./parse-inp-with-eps";

describe("parse EPS timing", () => {
  const baseInp = `
    [JUNCTIONS]
    j1\t100

    [RESERVOIRS]
    r1\t200

    [PIPES]
    p1\tr1\tj1\t1000\t100\t100\t0

    [COORDINATES]
    j1\t10\t20
    r1\t30\t40
  `;

  it("parses DURATION in HH:MM format", () => {
    const inp = `${baseInp}
    [TIMES]
    DURATION\t24:00
    `;

    const { hydraulicModel } = parseInpWithEPS(inp);

    expect(hydraulicModel.epsTiming.duration).toEqual(24 * 3600);
  });

  it("parses DURATION in HH:MM:SS format", () => {
    const inp = `${baseInp}
    [TIMES]
    DURATION\t1:30:00
    `;

    const { hydraulicModel } = parseInpWithEPS(inp);

    expect(hydraulicModel.epsTiming.duration).toEqual(1 * 3600 + 30 * 60);
  });

  it("parses DURATION with HOURS unit", () => {
    const inp = `${baseInp}
    [TIMES]
    DURATION\t48 HOURS
    `;

    const { hydraulicModel } = parseInpWithEPS(inp);

    expect(hydraulicModel.epsTiming.duration).toEqual(48 * 3600);
  });

  it("parses DURATION with numeric value (assumes hours)", () => {
    const inp = `${baseInp}
    [TIMES]
    DURATION\t12
    `;

    const { hydraulicModel } = parseInpWithEPS(inp);

    expect(hydraulicModel.epsTiming.duration).toEqual(12 * 3600);
  });

  it("parses HYDRAULIC TIMESTEP", () => {
    const inp = `${baseInp}
    [TIMES]
    HYDRAULIC TIMESTEP\t1:00
    `;

    const { hydraulicModel } = parseInpWithEPS(inp);

    expect(hydraulicModel.epsTiming.hydraulicTimestep).toEqual(3600);
  });

  it("parses REPORT TIMESTEP", () => {
    const inp = `${baseInp}
    [TIMES]
    REPORT TIMESTEP\t0:30
    `;

    const { hydraulicModel } = parseInpWithEPS(inp);

    expect(hydraulicModel.epsTiming.reportTimestep).toEqual(30 * 60);
  });

  it("parses PATTERN TIMESTEP", () => {
    const inp = `${baseInp}
    [TIMES]
    PATTERN TIMESTEP\t1:00
    `;

    const { hydraulicModel } = parseInpWithEPS(inp);

    expect(hydraulicModel.epsTiming.patternTimestep).toEqual(3600);
  });

  it("parses all time settings together", () => {
    const inp = `${baseInp}
    [TIMES]
    DURATION\t24:00
    HYDRAULIC TIMESTEP\t1:00
    REPORT TIMESTEP\t1:00
    PATTERN TIMESTEP\t1:00
    `;

    const { hydraulicModel } = parseInpWithEPS(inp);

    expect(hydraulicModel.epsTiming.duration).toEqual(24 * 3600);
    expect(hydraulicModel.epsTiming.hydraulicTimestep).toEqual(3600);
    expect(hydraulicModel.epsTiming.reportTimestep).toEqual(3600);
    expect(hydraulicModel.epsTiming.patternTimestep).toEqual(3600);
  });

  it("leaves time settings undefined when not specified", () => {
    const { hydraulicModel } = parseInpWithEPS(baseInp);

    expect(hydraulicModel.epsTiming.duration).toBeUndefined();
    expect(hydraulicModel.epsTiming.hydraulicTimestep).toBeUndefined();
    expect(hydraulicModel.epsTiming.reportTimestep).toBeUndefined();
    expect(hydraulicModel.epsTiming.patternTimestep).toBeUndefined();
  });

  it("reports unsupported time setting: PATTERN START", () => {
    const inp = `${baseInp}
    [TIMES]
    PATTERN START\t6:00
    `;

    const { issues } = parseInpWithEPS(inp);

    expect(issues?.nonDefaultTimes?.has("PATTERN START")).toBe(true);
  });

  it("reports unsupported time setting: QUALITY TIMESTEP", () => {
    const inp = `${baseInp}
    [TIMES]
    QUALITY TIMESTEP\t0:05
    `;

    const { issues } = parseInpWithEPS(inp);

    expect(issues?.nonDefaultTimes?.has("QUALITY TIMESTEP")).toBe(true);
  });

  it("reports unsupported time setting: STATISTIC", () => {
    const inp = `${baseInp}
    [TIMES]
    STATISTIC\tAVERAGE
    `;

    const { issues } = parseInpWithEPS(inp);

    expect(issues?.nonDefaultTimes?.has("STATISTIC")).toBe(true);
  });
});
