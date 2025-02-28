import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { replaceIdWithLabels } from "./report";

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
});
