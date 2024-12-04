import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildInp } from "./build-inp";
import { runSimulation } from "./epanet-simulation";

describe("epanet simulation", () => {
  it("includes a report", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir("r1")
      .aJunction("j1")
      .aPipe("p1", "r1", "j1")
      .build();
    const inp = buildInp(hydraulicModel);

    const { status, report } = runSimulation(inp);

    expect(status).toEqual("success");
    expect(report).not.toContain("Error");
  });

  it("reports says when simulation fails", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir("r1")
      .aReservoir("r2")
      .aPipe("p1", "r1", "r2", {})
      .build();
    const inp = buildInp(hydraulicModel);
    const { status, report } = runSimulation(inp);

    expect(status).toEqual("failure");
    expect(report).toContain("Error 223: not enough nodes");
  });

  it("can include multiple errors in the report", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir("r1")
      .aJunction("j1")
      .aPipe("p1", "r1", "j1")
      .aJunction("j2")
      .build();
    const inp = buildInp(hydraulicModel);
    const { status, report } = runSimulation(inp);

    expect(status).toEqual("failure");
    expect(report.match(/Error 233/gi)!.length).toEqual(1);
    expect(report).toContain("j2");
    expect(report).toContain("Error 200");
  });
});
