import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { replaceIdWithLabels, processReportWithSlots } from "./report";
import * as errorTracking from "src/infra/error-tracking";

describe("report utils", () => {
  it("can replace labels in error messages", () => {
    const assets = HydraulicModelBuilder.with()
      .aPipe("1", { label: "P1_LABEL" })
      .aPipe("1234", { label: "P1234_LABEL" })
      .aPipe("56", { label: "P56_LABEL" })
      .build().assets;
    const report = `
    Error 233: Error 1
    Error 215: Pipe 1234 is a duplicate ID.
      other line
    Error 216: a longer message 56 invalid.
    `;

    const output = replaceIdWithLabels(report, assets);

    expect(output).toContain("Error 233: Error P1_LABEL");
    expect(output).toContain("Error 215: Pipe P1234_LABEL is a duplicate ID.");
    expect(output).toContain("other line");
    expect(output).toContain("Error 216: a longer message P56_LABEL invalid.");
  });

  it("doesn't replace error codes with labels", () => {
    const assets = HydraulicModelBuilder.with()
      .aPipe("233", { label: "LABEL_2" })
      .build().assets;
    const report = `
    Error 233: Error 233
    `;

    const output = replaceIdWithLabels(report, assets);

    expect(output).toContain("Error 233: Error LABEL_2");
  });

  it("doesnot replace errors from values", () => {
    const assets = HydraulicModelBuilder.with()
      .aPipe("0", { label: "P1_LABEL" })
      .build().assets;
    const report = `
    Error 213: invalid option value 0 in [VALVES] section:
  234	102	13	300	14	0
    `;

    const output = replaceIdWithLabels(report, assets);

    expect(output).toContain("Error 213: invalid option value 0 in [VALVES]");
  });

  it("can replace labels refering to asset types", () => {
    const assets = HydraulicModelBuilder.with()
      .aPipe("1", { label: "P1_LABEL" })
      .aPipe("1234", { label: "P1234_LABEL" })
      .aPipe("56", { label: "P56_LABEL" })
      .aReservoir("14", { label: "R_14" })
      .aJunction("19", { label: "J_19" })
      .build().assets;

    const report = `
    0:00:00: Reservoir 14 is closed
    WARNING: Node 19 disconnected at 0:00:00 hrs
      maximum  flow change = 0.0001 for Link 56
      Node 19 and Pipe 56
    Pump not working today
    `;

    const output = replaceIdWithLabels(report, assets);

    expect(output).toContain("0:00:00: Reservoir R_14 is closed");
    expect(output).toContain("WARNING: Node J_19 disconnected at 0:00:00 hrs");
    expect(output).toContain(
      "  maximum  flow change = 0.0001 for Link P56_LABEL",
    );
    expect(output).toContain("Node J_19 and Pipe P56_LABEL");
    expect(output).toContain("Pump not working today");
  });

  it("can refer labels referring to valves", () => {
    const assets = HydraulicModelBuilder.with()
      .aValve("1", { label: "MY_VALVE" })
      .aValve("20", { label: "OTHER" })
      .build().assets;

    const report = `
    0:00:00: PRV 1 open but cannot deliver pressure
    0:00:00: FCV 20 open but cannot deliver pressure
    WARNING: PRV 1 open but cannot deliver pressure
    `;

    const output = replaceIdWithLabels(report, assets);

    expect(output).toContain("0:00:00: PRV MY_VALVE open but");
    expect(output).toContain("0:00:00: FCV OTHER open but");
    expect(output).toContain("WARNING: PRV MY_VALVE open but");
  });

  it("can replace node id in ill-conditioned system messages", () => {
    const assets = HydraulicModelBuilder.with()
      .aJunction("51638", { label: "J_PROBLEMATIC" })
      .build().assets;

    const report = `   0:00:00: System ill-conditioned at node 51638`;

    const output = replaceIdWithLabels(report, assets);

    expect(output).toContain(
      "   0:00:00: System ill-conditioned at node J_PROBLEMATIC",
    );
  });

  it("does not replace property values in Error 211 messages", () => {
    const assets = HydraulicModelBuilder.with()
      .aPipe("0", { label: "P_ZERO" })
      .build().assets;

    const report = `Error 211: illegal link property value 0 0`;

    const output = replaceIdWithLabels(report, assets);

    expect(output).toContain("Error 211: illegal link property value 0 0");
    expect(output).not.toContain("P_ZERO");
  });

  it("captures error when match found but asset not found", () => {
    const assets = HydraulicModelBuilder.with().build().assets;
    const captureErrorSpy = vi.spyOn(errorTracking, "captureError");

    const report = `Error 205: Node 999 has missing data`;

    const output = replaceIdWithLabels(report, assets);

    expect(output).toContain("Error 205: Node 999 has missing data");
    expect(captureErrorSpy).toHaveBeenCalled();
  });
});

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

  it("captures error when asset not found but preserves original text", () => {
    const assets = HydraulicModelBuilder.with().build().assets;
    const captureErrorSpy = vi.spyOn(errorTracking, "captureError");

    const report = `Error 205: Node 999 has missing data`;

    const result = processReportWithSlots(report, assets);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      text: "Error 205: Node 999 has missing data",
      assetSlots: [],
    });
    expect(captureErrorSpy).toHaveBeenCalled();
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
});
