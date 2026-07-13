import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { processReportWithSlots } from "./report";

describe("processReportWithSlots", () => {
  it("processes simple error messages into slots", () => {
    const IDS = { P1: 1, P1234: 1234 };
    const assets = HydraulicModelBuilder.with()
      .aPipe(IDS.P1, { label: "P1_LABEL" })
      .aPipe(IDS.P1234, { label: "P1234_LABEL" })
      .build().assets;

    const report = `Error 233: Error 1
Error 215: Pipe 1234 is a duplicate ID.`;

    const { processedReport } = processReportWithSlots(report, assets);

    expect(processedReport).toHaveLength(2);
    expect(processedReport[0]).toEqual({
      text: "Error 233: Error {{0}}",
      assetSlots: [IDS.P1],
    });
    expect(processedReport[1]).toEqual({
      text: "Error 215: Pipe {{0}} is a duplicate ID.",
      assetSlots: [IDS.P1234],
    });
  });

  it("handles multiple asset references in single row", () => {
    const IDS = { J19: 19, P56: 56 };
    const assets = HydraulicModelBuilder.with()
      .aJunction(IDS.J19, { label: "J_19" })
      .aPipe(IDS.P56, { label: "P56_LABEL" })
      .build().assets;

    const report = `Node 19 and Pipe 56 are connected`;

    const { processedReport } = processReportWithSlots(report, assets);

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: "Node {{0}} and Pipe {{1}} are connected",
      assetSlots: [IDS.J19, IDS.P56],
    });
  });

  it("preserves rows without asset references", () => {
    const assets = HydraulicModelBuilder.with().build().assets;

    const report = `This is a normal line
Another normal line`;

    const { processedReport } = processReportWithSlots(report, assets);

    expect(processedReport).toHaveLength(2);
    expect(processedReport[0]).toEqual({
      text: "This is a normal line",
      assetSlots: [],
    });
    expect(processedReport[1]).toEqual({
      text: "Another normal line",
      assetSlots: [],
    });
  });

  it("handles valve type references", () => {
    const IDS = { V1: 1, V20: 20 };
    const assets = HydraulicModelBuilder.with()
      .aValve(IDS.V1, { label: "MY_VALVE" })
      .aValve(IDS.V20, { label: "OTHER" })
      .build().assets;

    const report = `PRV 1 open but cannot deliver pressure
FCV 20 open but cannot deliver pressure`;

    const { processedReport } = processReportWithSlots(report, assets);

    expect(processedReport).toHaveLength(2);
    expect(processedReport[0]).toEqual({
      text: "PRV {{0}} open but cannot deliver pressure",
      assetSlots: [IDS.V1],
    });
    expect(processedReport[1]).toEqual({
      text: "FCV {{0}} open but cannot deliver pressure",
      assetSlots: [IDS.V20],
    });
  });

  it("skips Error 213 and Error 211 as expected", () => {
    const IDS = { P0: 1 };
    const assets = HydraulicModelBuilder.with()
      .aPipe(IDS.P0, { label: "P_ZERO" })
      .build().assets;

    const report = `Error 213: invalid option value 0 in [VALVES] section
Error 211: illegal link property value 0 0`;

    const { processedReport } = processReportWithSlots(report, assets);

    expect(processedReport).toHaveLength(2);
    expect(processedReport[0]).toEqual({
      text: "Error 213: invalid option value 0 in [VALVES] section",
      assetSlots: [],
    });
    expect(processedReport[1]).toEqual({
      text: "Error 211: illegal link property value 0 0",
      assetSlots: [],
    });
  });

  it("handles complex multi-asset scenarios", () => {
    const IDS = { R14: 14, J19: 19, P56: 56 };
    const assets = HydraulicModelBuilder.with()
      .aReservoir(IDS.R14, { label: "R_14" })
      .aJunction(IDS.J19, { label: "J_19" })
      .aPipe(IDS.P56, { label: "P56_LABEL" })
      .build().assets;

    const report = `0:00:00: Reservoir 14 is closed
WARNING: Node 19 disconnected at 0:00:00 hrs
maximum flow change = 0.0001 for Link 56
Node 19 and Pipe 56`;

    const { processedReport } = processReportWithSlots(report, assets);

    expect(processedReport).toHaveLength(4);
    expect(processedReport[0]).toEqual({
      text: "0:00:00: Reservoir {{0}} is closed",
      assetSlots: [IDS.R14],
    });
    expect(processedReport[1]).toEqual({
      text: "WARNING: Node {{0}} disconnected at 0:00:00 hrs",
      assetSlots: [IDS.J19],
    });
    expect(processedReport[2]).toEqual({
      text: "maximum flow change = 0.0001 for Link {{0}}",
      assetSlots: [IDS.P56],
    });
    expect(processedReport[3]).toEqual({
      text: "Node {{0}} and Pipe {{1}}",
      assetSlots: [IDS.J19, IDS.P56],
    });
  });

  it("does not match valve type when no word follows", () => {
    const IDS = { J0: 1 };
    const assets = HydraulicModelBuilder.with()
      .aJunction(IDS.J0, { label: "J0" })
      .build().assets;

    const report = `Configuration: TCV 0`;

    const { processedReport } = processReportWithSlots(report, assets);

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: "Configuration: TCV 0",
      assetSlots: [],
    });
  });

  it("replaces IDs with labels in VALVES section rows", () => {
    const IDS = { V7: 7, J2: 2, J3: 3 };
    const assets = HydraulicModelBuilder.with()
      .aValve(IDS.V7, { label: "V7" })
      .aJunction(IDS.J2, { label: "J2" })
      .aJunction(IDS.J3, { label: "J3" })
      .build().assets;

    const report = ` 7\t2\t3\t300\tTCV\t0\t0`;

    const { processedReport } = processReportWithSlots(report, assets);

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: " {{0}}\t{{1}}\t{{2}}\t300\tTCV\t0\t0",
      assetSlots: [IDS.V7, IDS.J2, IDS.J3],
    });
  });

  it("replaces IDs with labels in PCV VALVES section rows", () => {
    const IDS = { V7: 7, J2: 2, J3: 3 };
    const assets = HydraulicModelBuilder.with()
      .aValve(IDS.V7, { label: "V7" })
      .aJunction(IDS.J2, { label: "J2" })
      .aJunction(IDS.J3, { label: "J3" })
      .build().assets;

    const report = ` 7\t2\t3\t300\tPCV\t0\t0`;

    const { processedReport } = processReportWithSlots(report, assets);

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: " {{0}}\t{{1}}\t{{2}}\t300\tPCV\t0\t0",
      assetSlots: [IDS.V7, IDS.J2, IDS.J3],
    });
  });

  it("matches remaining valve ids without flagging a MISSING node column", () => {
    const IDS = { V7: 7, J2: 2 };
    const assets = HydraulicModelBuilder.with()
      .aValve(IDS.V7, { label: "V7" })
      .aJunction(IDS.J2, { label: "J2" })
      .build().assets;

    const report = ` 7\t2\tMISSING\t300\tTCV\t0\t0`;

    const { processedReport, errorCollector } = processReportWithSlots(
      report,
      assets,
    );

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: " {{0}}\t{{1}}\tMISSING\t300\tTCV\t0\t0",
      assetSlots: [IDS.V7, IDS.J2],
    });
    expect(errorCollector.hasErrors()).toBe(false);
  });

  it("replaces IDs with labels in space-aligned VALVES section rows", () => {
    const IDS = { V7: 7, J2: 2, J3: 3 };
    const assets = HydraulicModelBuilder.with()
      .aValve(IDS.V7, { label: "V7" })
      .aJunction(IDS.J2, { label: "J2" })
      .aJunction(IDS.J3, { label: "J3" })
      .build().assets;

    const report = ` 7    2     3     300     TCV     0     0`;

    const { processedReport } = processReportWithSlots(report, assets);

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: " {{0}}    {{1}}     {{2}}     300     TCV     0     0",
      assetSlots: [IDS.V7, IDS.J2, IDS.J3],
    });
  });

  it("replaces IDs with labels in VALVES section rows with a missing diameter", () => {
    const IDS = { V7: 7, J2: 2, J3: 3 };
    const assets = HydraulicModelBuilder.with()
      .aValve(IDS.V7, { label: "V7" })
      .aJunction(IDS.J2, { label: "J2" })
      .aJunction(IDS.J3, { label: "J3" })
      .build().assets;

    const report = ` 7\t2\t3\tMISSING\tTCV\t0\t0`;

    const { processedReport, errorCollector } = processReportWithSlots(
      report,
      assets,
    );

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: " {{0}}\t{{1}}\t{{2}}\tMISSING\tTCV\t0\t0",
      assetSlots: [IDS.V7, IDS.J2, IDS.J3],
    });
    expect(errorCollector.hasErrors()).toBe(false);
  });

  it("replaces IDs with labels in PIPES section rows", () => {
    const IDS = { P1: 1, J1: 2, J2: 3 };
    const assets = HydraulicModelBuilder.with()
      .aPipe(IDS.P1, { label: "Pipe1" })
      .aJunction(IDS.J1, { label: "Junction1" })
      .aJunction(IDS.J2, { label: "Junction2" })
      .build().assets;

    const report = `1    2     3     1200      12      120       0.2     OPEN`;

    const { processedReport } = processReportWithSlots(report, assets);

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: "{{0}}    {{1}}     {{2}}     1200      12      120       0.2     OPEN",
      assetSlots: [IDS.P1, IDS.J1, IDS.J2],
    });
  });

  it("replaces IDs with labels in PIPES section rows with a missing roughness", () => {
    const IDS = { P1: 1, J1: 2, J2: 3 };
    const assets = HydraulicModelBuilder.with()
      .aPipe(IDS.P1, { label: "Pipe1" })
      .aJunction(IDS.J1, { label: "Junction1" })
      .aJunction(IDS.J2, { label: "Junction2" })
      .build().assets;

    const report = `1\t2\t3\t1000\t300\tMISSING`;

    const { processedReport } = processReportWithSlots(report, assets);

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: "{{0}}\t{{1}}\t{{2}}\t1000\t300\tMISSING",
      assetSlots: [IDS.P1, IDS.J1, IDS.J2],
    });
  });

  it("replaces IDs with labels in PIPES section rows with a missing length", () => {
    const IDS = { P1: 1, J1: 2, J2: 3 };
    const assets = HydraulicModelBuilder.with()
      .aPipe(IDS.P1, { label: "Pipe1" })
      .aJunction(IDS.J1, { label: "Junction1" })
      .aJunction(IDS.J2, { label: "Junction2" })
      .build().assets;

    const report = `1\t2\t3\tMISSING\t300\t130`;

    const { processedReport, errorCollector } = processReportWithSlots(
      report,
      assets,
    );

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: "{{0}}\t{{1}}\t{{2}}\tMISSING\t300\t130",
      assetSlots: [IDS.P1, IDS.J1, IDS.J2],
    });
    expect(errorCollector.hasErrors()).toBe(false);
  });

  it("replaces IDs with labels in PIPES section rows with a missing diameter", () => {
    const IDS = { P1: 1, J1: 2, J2: 3 };
    const assets = HydraulicModelBuilder.with()
      .aPipe(IDS.P1, { label: "Pipe1" })
      .aJunction(IDS.J1, { label: "Junction1" })
      .aJunction(IDS.J2, { label: "Junction2" })
      .build().assets;

    const report = `1\t2\t3\t1000\tMISSING\t130`;

    const { processedReport, errorCollector } = processReportWithSlots(
      report,
      assets,
    );

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: "{{0}}\t{{1}}\t{{2}}\t1000\tMISSING\t130",
      assetSlots: [IDS.P1, IDS.J1, IDS.J2],
    });
    expect(errorCollector.hasErrors()).toBe(false);
  });

  it("matches remaining asset ids without flagging a MISSING node as an error", () => {
    const IDS = { P1: 3, J1: 1 };
    const assets = HydraulicModelBuilder.with()
      .aPipe(IDS.P1, { label: "Pipe1" })
      .aJunction(IDS.J1, { label: "Junction1" })
      .build().assets;

    const report = `3\t1\tMISSING\t10\t100\t130`;

    const { processedReport, errorCollector } = processReportWithSlots(
      report,
      assets,
    );

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: "{{0}}\t{{1}}\tMISSING\t10\t100\t130",
      assetSlots: [IDS.P1, IDS.J1],
    });
    expect(errorCollector.hasErrors()).toBe(false);
  });

  it("still flags a genuinely missing numeric node id as an error", () => {
    const IDS = { P1: 3, J1: 1 };
    const assets = HydraulicModelBuilder.with()
      .aPipe(IDS.P1, { label: "Pipe1" })
      .aJunction(IDS.J1, { label: "Junction1" })
      .build().assets;

    // Node 2 is not "MISSING" but is absent from the model: a real issue.
    const report = `3\t1\t2\t10\t100\t130`;

    const { errorCollector } = processReportWithSlots(report, assets);

    expect(errorCollector.hasErrors()).toBe(true);
    expect(errorCollector.getErrors()).toMatchObject([{ id: "2" }]);
  });

  it("replaces IDs with labels in PUMPS section rows", () => {
    const IDS = { PUMP1: 1, N12: 12, N32: 32 };
    const assets = HydraulicModelBuilder.with()
      .aPump(IDS.PUMP1, { label: "MainPump" })
      .aJunction(IDS.N12, { label: "Node12" })
      .aJunction(IDS.N32, { label: "Node32" })
      .build().assets;

    const report = `1   12     32     HEAD Curve1  SPEED 1.2`;

    const { processedReport } = processReportWithSlots(report, assets);

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: "{{0}}   {{1}}     {{2}}     HEAD Curve1  SPEED 1.2",
      assetSlots: [IDS.PUMP1, IDS.N12, IDS.N32],
    });
  });

  it("does not replace error code with asset link when error text contains pump section keywords", () => {
    const IDS = { PU1: 91, P91: 227 } as const;
    const assets = HydraulicModelBuilder.with()
      .aPump(IDS.PU1, { label: "PU1" })
      .aPipe(IDS.P91, { label: "P91" })
      .build().assets;

    const report = ` Error 227: invalid head curve for Pump 91`;

    const { processedReport } = processReportWithSlots(report, assets);

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: " Error 227: invalid head curve for Pump {{0}}",
      assetSlots: [IDS.PU1],
    });
  });

  it("does not flag literal numeric values in error messages as missing assets", () => {
    const assets = HydraulicModelBuilder.with().build().assets;

    const report = ` Error 202: illegal numeric value 0 in [PIPES] section:`;

    const { processedReport, errorCollector } = processReportWithSlots(
      report,
      assets,
    );

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: ` Error 202: illegal numeric value 0 in [PIPES] section:`,
      assetSlots: [],
    });
    expect(errorCollector.hasErrors()).toBe(false);
  });

  it("does not flag rule numbers in input error messages as missing assets", () => {
    const assets = HydraulicModelBuilder.with().build().assets;

    const report = ` Input Error 204: undefined link in following line of Rule 3:`;

    const { processedReport, errorCollector } = processReportWithSlots(
      report,
      assets,
    );

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: ` Input Error 204: undefined link in following line of Rule 3:`,
      assetSlots: [],
    });
    expect(errorCollector.hasErrors()).toBe(false);
  });

  it("does not flag literal value numbers in error messages as missing assets", () => {
    const assets = HydraulicModelBuilder.with().build().assets;

    const report = ` Error 217: invalid pattern value 5 for tank`;

    const { processedReport, errorCollector } = processReportWithSlots(
      report,
      assets,
    );

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: ` Error 217: invalid pattern value 5 for tank`,
      assetSlots: [],
    });
    expect(errorCollector.hasErrors()).toBe(false);
  });

  it("does not flag undefined curve numbers in error messages as missing assets", () => {
    const assets = HydraulicModelBuilder.with().build().assets;

    const report = ` Error 206: undefined curve 0 in [VALVES] section:`;

    const { processedReport, errorCollector } = processReportWithSlots(
      report,
      assets,
    );

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: ` Error 206: undefined curve 0 in [VALVES] section:`,
      assetSlots: [],
    });
    expect(errorCollector.hasErrors()).toBe(false);
  });

  it("handles error messages with missing tank node correctly", () => {
    const assets = HydraulicModelBuilder.with().build().assets;

    const report = ` Error 225: invalid lower/upper levels for tank node 42`;

    const { processedReport, errorCollector } = processReportWithSlots(
      report,
      assets,
    );

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: ` Error 225: invalid lower/upper levels for tank node 42`,
      assetSlots: [],
    });

    const errors = errorCollector.getErrors();
    expect(errors).toHaveLength(2);

    expect(errors[0]).toMatchObject({
      reportLine: " Error 225: invalid lower/upper levels for tank node 42",
      reason: "missing_asset",
      match: "Error 225: invalid lower/upper levels for tank node 42",
      id: "42",
      regexp:
        "/Error \\d{3}:.*?(?<!(?:Rule|line|value|level|trial|trials|step|section|curve)\\s)(?<!\\d\\.)\\b(\\d+)\\b(?!\\.\\d)/",
    });

    expect(errors[1]).toMatchObject({
      reportLine: " Error 225: invalid lower/upper levels for tank node 42",
      reason: "missing_asset",
      match: "node 42",
      id: "42",
      regexp:
        "/(?:Link|Junction|Pipe|Reservoir|Node|Valve|Pump|Tank|node)\\s+(\\d+)/gi",
    });
  });

  it("does not flag the decimals of an undefined curve id as missing assets", () => {
    const assets = HydraulicModelBuilder.with().build().assets;

    const report = ` Error 206: undefined curve 0.0001 in [VALVES] section:`;

    const { processedReport, errorCollector } = processReportWithSlots(
      report,
      assets,
    );

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: ` Error 206: undefined curve 0.0001 in [VALVES] section:`,
      assetSlots: [],
    });
    expect(errorCollector.hasErrors()).toBe(false);
  });

  it("does not flag decimal option values as missing assets", () => {
    const assets = HydraulicModelBuilder.with().build().assets;

    const report = ` Error 208: illegal PDA pressure limits 0.1 in [OPTIONS] section:`;

    const { processedReport, errorCollector } = processReportWithSlots(
      report,
      assets,
    );

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: ` Error 208: illegal PDA pressure limits 0.1 in [OPTIONS] section:`,
      assetSlots: [],
    });
    expect(errorCollector.hasErrors()).toBe(false);
  });

  it("skips Error 208 when the option value is an integer", () => {
    const IDS = { J5: 5 };
    const assets = HydraulicModelBuilder.with()
      .aJunction(IDS.J5, { label: "J5" })
      .build().assets;

    const report = ` Error 208: illegal PDA pressure limits 20 in [OPTIONS] section:`;

    const { processedReport, errorCollector } = processReportWithSlots(
      report,
      assets,
    );

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: ` Error 208: illegal PDA pressure limits 20 in [OPTIONS] section:`,
      assetSlots: [],
    });
    expect(errorCollector.hasErrors()).toBe(false);
  });

  it("does not read a rule line as a pumps section row", () => {
    const IDS = { T1: 12269 };
    const assets = HydraulicModelBuilder.with()
      .aTank(IDS.T1, { label: "T1" })
      .build().assets;

    const report = `  IF TANK 12269 HEAD = 89`;

    const { processedReport, errorCollector } = processReportWithSlots(
      report,
      assets,
    );

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: "  IF TANK {{0}} HEAD = 89",
      assetSlots: [IDS.T1],
    });
    expect(errorCollector.hasErrors()).toBe(false);
  });

  it("does not flag rule keywords as missing assets", () => {
    const assets = HydraulicModelBuilder.with().build().assets;

    const report = `  IF TANK 12269 HEAD = 89`;

    const { errorCollector } = processReportWithSlots(report, assets);

    const flaggedIds = errorCollector.getErrors().map((error) => error.id);
    expect(flaggedIds).not.toContain("IF");
    expect(flaggedIds).not.toContain("TANK");
  });
});
