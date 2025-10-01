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

    const result = processReportWithSlots(report, assets);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      text: "Error 233: Error {{0}}",
      assetSlots: ["1"],
    });
    expect(result[1]).toEqual({
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

    const result = processReportWithSlots(report, assets);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      text: "Node {{0}} and Pipe {{1}} are connected",
      assetSlots: ["19", "56"],
    });
  });

  it("preserves rows without asset references", () => {
    const assets = HydraulicModelBuilder.with().build().assets;

    const report = `This is a normal line
Another normal line`;

    const result = processReportWithSlots(report, assets);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      text: "This is a normal line",
      assetSlots: [],
    });
    expect(result[1]).toEqual({
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

    const result = processReportWithSlots(report, assets);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      text: "PRV {{0}} open but cannot deliver pressure",
      assetSlots: ["1"],
    });
    expect(result[1]).toEqual({
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

    const result = processReportWithSlots(report, assets);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      text: "Error 213: invalid option value 0 in [VALVES] section",
      assetSlots: [],
    });
    expect(result[1]).toEqual({
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

    const result = processReportWithSlots(report, assets);

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({
      text: "0:00:00: Reservoir {{0}} is closed",
      assetSlots: ["14"],
    });
    expect(result[1]).toEqual({
      text: "WARNING: Node {{0}} disconnected at 0:00:00 hrs",
      assetSlots: ["19"],
    });
    expect(result[2]).toEqual({
      text: "maximum flow change = 0.0001 for Link {{0}}",
      assetSlots: ["56"],
    });
    expect(result[3]).toEqual({
      text: "Node {{0}} and Pipe {{1}}",
      assetSlots: ["19", "56"],
    });
  });

  it("does not match valve type in tabular data", () => {
    const assets = HydraulicModelBuilder.with()
      .aValve("7", { label: "V7" })
      .aJunction("2", { label: "J2" })
      .aJunction("0", { label: "J0" })
      .build().assets;

    const report = ` 7\t2\t2\t300\tTCV\t0\t0`;

    const result = processReportWithSlots(report, assets);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      text: " 7\t2\t2\t300\tTCV\t0\t0",
      assetSlots: [],
    });
  });
});
