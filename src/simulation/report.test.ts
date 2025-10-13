import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { processReportWithSlots } from "./report";

describe("processReportWithSlots", () => {
  it("processes simple error messages into slots", () => {
    const assets = HydraulicModelBuilder.with()
      .aPipe("1", { label: "P1_LABEL" })
      .aPipe("1234", { label: "P1234_LABEL" })
      .build().assets;

    const report = `Error 233: Error 1
Error 215: Pipe 1234 is a duplicate ID.`;

    const { processedReport } = processReportWithSlots(report, assets);

    expect(processedReport).toHaveLength(2);
    expect(processedReport[0]).toEqual({
      text: "Error 233: Error {{0}}",
      assetSlots: ["1"],
    });
    expect(processedReport[1]).toEqual({
      text: "Error 215: Pipe {{0}} is a duplicate ID.",
      assetSlots: ["1234"],
    });
  });

  it("handles multiple asset references in single row", () => {
    const assets = HydraulicModelBuilder.with()
      .aJunction("19", { label: "J_19" })
      .aPipe("56", { label: "P56_LABEL" })
      .build().assets;

    const report = `Node 19 and Pipe 56 are connected`;

    const { processedReport } = processReportWithSlots(report, assets);

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: "Node {{0}} and Pipe {{1}} are connected",
      assetSlots: ["19", "56"],
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
    const assets = HydraulicModelBuilder.with()
      .aValve("1", { label: "MY_VALVE" })
      .aValve("20", { label: "OTHER" })
      .build().assets;

    const report = `PRV 1 open but cannot deliver pressure
FCV 20 open but cannot deliver pressure`;

    const { processedReport } = processReportWithSlots(report, assets);

    expect(processedReport).toHaveLength(2);
    expect(processedReport[0]).toEqual({
      text: "PRV {{0}} open but cannot deliver pressure",
      assetSlots: ["1"],
    });
    expect(processedReport[1]).toEqual({
      text: "FCV {{0}} open but cannot deliver pressure",
      assetSlots: ["20"],
    });
  });

  it("skips Error 213 and Error 211 as expected", () => {
    const assets = HydraulicModelBuilder.with()
      .aPipe("0", { label: "P_ZERO" })
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
    const assets = HydraulicModelBuilder.with()
      .aReservoir("14", { label: "R_14" })
      .aJunction("19", { label: "J_19" })
      .aPipe("56", { label: "P56_LABEL" })
      .build().assets;

    const report = `0:00:00: Reservoir 14 is closed
WARNING: Node 19 disconnected at 0:00:00 hrs
maximum flow change = 0.0001 for Link 56
Node 19 and Pipe 56`;

    const { processedReport } = processReportWithSlots(report, assets);

    expect(processedReport).toHaveLength(4);
    expect(processedReport[0]).toEqual({
      text: "0:00:00: Reservoir {{0}} is closed",
      assetSlots: ["14"],
    });
    expect(processedReport[1]).toEqual({
      text: "WARNING: Node {{0}} disconnected at 0:00:00 hrs",
      assetSlots: ["19"],
    });
    expect(processedReport[2]).toEqual({
      text: "maximum flow change = 0.0001 for Link {{0}}",
      assetSlots: ["56"],
    });
    expect(processedReport[3]).toEqual({
      text: "Node {{0}} and Pipe {{1}}",
      assetSlots: ["19", "56"],
    });
  });

  it("does not match valve type when no word follows", () => {
    const assets = HydraulicModelBuilder.with()
      .aJunction("0", { label: "J0" })
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
    const assets = HydraulicModelBuilder.with()
      .aValve("7", { label: "V7" })
      .aJunction("2", { label: "J2" })
      .aJunction("3", { label: "J3" })
      .build().assets;

    const report = ` 7\t2\t3\t300\tTCV\t0\t0`;

    const { processedReport } = processReportWithSlots(report, assets);

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: " {{0}}\t{{1}}\t{{2}}\t300\tTCV\t0\t0",
      assetSlots: ["7", "2", "3"],
    });
  });

  it("replaces IDs with labels in PIPES section rows", () => {
    const assets = HydraulicModelBuilder.with()
      .aPipe("P1", { label: "Pipe1" })
      .aJunction("J1", { label: "Junction1" })
      .aJunction("J2", { label: "Junction2" })
      .build().assets;

    const report = `P1    J1     J2     1200      12      120       0.2     OPEN`;

    const { processedReport } = processReportWithSlots(report, assets);

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: "{{0}}    {{1}}     {{2}}     1200      12      120       0.2     OPEN",
      assetSlots: ["P1", "J1", "J2"],
    });
  });

  it("replaces IDs with labels in PUMPS section rows", () => {
    const assets = HydraulicModelBuilder.with()
      .aPump("Pump1", { label: "MainPump" })
      .aJunction("N12", { label: "Node12" })
      .aJunction("N32", { label: "Node32" })
      .build().assets;

    const report = `Pump1   N12     N32     HEAD Curve1  SPEED 1.2`;

    const { processedReport } = processReportWithSlots(report, assets);

    expect(processedReport).toHaveLength(1);
    expect(processedReport[0]).toEqual({
      text: "{{0}}   {{1}}     {{2}}     HEAD Curve1  SPEED 1.2",
      assetSlots: ["Pump1", "N12", "N32"],
    });
  });
});
