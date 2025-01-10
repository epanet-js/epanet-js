import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { lib } from "src/lib/worker";
import { buildInp } from "../build-inp";
import { runSimulation } from "./main";
import { runSimulation as workerRunSimulation } from "./worker";
import { Mock } from "vitest";

vi.mock("src/lib/worker", () => ({
  lib: {
    runSimulation: vi.fn(),
  },
}));

describe("epanet simulation", () => {
  beforeEach(() => {
    wireWebWorker();
  });

  it("includes a report", async () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir("r1")
      .aJunction("j1")
      .aPipe("p1", { startNodeId: "r1", endNodeId: "j1" })
      .build();
    const inp = buildInp(hydraulicModel);

    const { status, report } = await runSimulation(inp);

    expect(status).toEqual("success");
    expect(report).not.toContain("Error");
  });

  it("reports says when simulation fails", async () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir("r1")
      .aReservoir("r2")
      .aPipe("p1", { startNodeId: "r1", endNodeId: "r2" })
      .build();
    const inp = buildInp(hydraulicModel);
    const { status, report } = await runSimulation(inp);

    expect(status).toEqual("failure");
    expect(report).toContain("Error 223: not enough nodes");
  });

  it("can include multiple errors in the report", async () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir("r1")
      .aJunction("j1")
      .aPipe("p1", { startNodeId: "r1", endNodeId: "j1" })
      .aJunction("j2")
      .build();
    const inp = buildInp(hydraulicModel);
    const { status, report } = await runSimulation(inp);

    expect(status).toEqual("failure");
    expect(report.match(/Error 233/gi)!.length).toEqual(1);
    expect(report).toContain("j2");
    expect(report).toContain("Error 200");
  });

  describe("results reader", () => {
    it("can read simulation values", async () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir("r1")
        .aJunction("j1", { demand: 1 })
        .aPipe("p1", { startNodeId: "r1", endNodeId: "j1" })
        .build();
      const inp = buildInp(hydraulicModel);

      const { status, results } = await runSimulation(inp);

      expect(status).toEqual("success");
      expect(results.getPressure("j1")).toBeCloseTo(10);
      expect(results.getPressure("r1")).toBeCloseTo(0);
      expect(results.getFlow("p1")).toBeCloseTo(1);
      expect(results.getVelocity("p1")).toBeCloseTo(0.014);
    });

    it("provides null values when failed", async () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir("r1")
        .aJunction("j1", { demand: 1 })
        .aJunction("j2")
        .aPipe("p1", { startNodeId: "r1", endNodeId: "j1" })
        .build();
      const inp = buildInp(hydraulicModel);

      const { status, results } = await runSimulation(inp);

      expect(status).toEqual("failure");
      expect(results.getPressure("j1")).toBeNull();
      expect(results.getPressure("r1")).toBeNull();
      expect(results.getFlow("p1")).toBeNull();
    });
  });

  const wireWebWorker = () => {
    (lib.runSimulation as unknown as Mock).mockImplementation(
      workerRunSimulation,
    );
  };
});
