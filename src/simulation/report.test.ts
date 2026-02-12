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
      regexp: "/Error \\d{3}:.*?\\b(\\d+)\\b/",
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
});
