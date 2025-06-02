import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { lib } from "src/lib/worker";
import { buildInp } from "../build-inp";
import { runSimulation } from "./main";
import { runSimulation as workerRunSimulation } from "./worker";
import { Mock } from "vitest";
import { JunctionSimulation, ValveSimulation } from "../results-reader";
import { pumpStatusFor, valveStatusFor } from "./extract-simulation-results";
import { defaultSimulationSettings } from "../settings";

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
    const inp = buildInp(hydraulicModel, defaultSimulationSettings);

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
    const inp = buildInp(hydraulicModel, defaultSimulationSettings);
    const { status, report } = await runSimulation(inp);

    expect(status).toEqual("failure");
    expect(report).toContain("Error 223: not enough nodes");
  });

  it("report says when simulation has warnings", async () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir("r1", { head: 0 })
      .aJunction("j1", { demand: 10 })
      .aPipe("p1", { startNodeId: "r1", endNodeId: "j1" })
      .build();
    const inp = buildInp(hydraulicModel, defaultSimulationSettings);

    const { status, report } = await runSimulation(inp, { FLAG_WARNING: true });

    expect(status).toEqual("warning");
    expect(report).toContain("WARNING");
  });

  it("can include multiple errors in the report", async () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir("r1")
      .aJunction("j1")
      .aPipe("p1", { startNodeId: "r1", endNodeId: "j1" })
      .aJunction("j2")
      .build();
    const inp = buildInp(hydraulicModel, defaultSimulationSettings);
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
      const inp = buildInp(hydraulicModel, defaultSimulationSettings);

      const { status, results } = await runSimulation(inp);

      expect(status).toEqual("success");
      expect(results.getJunction("j1")!.pressure).toBeCloseTo(10);
      expect(results.getPipe("p1")!.flow).toBeCloseTo(1);
      expect(results.getPipe("p1")!.velocity).toBeCloseTo(0.014);
    });

    it("can read junction values", async () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir("r1", { head: 10 })
        .aJunction("j1", { demand: 1, elevation: 2 })
        .aValve("v1", { startNodeId: "r1", endNodeId: "j1" })
        .build();
      const inp = buildInp(hydraulicModel, defaultSimulationSettings);

      const { status, results } = await runSimulation(inp);

      expect(status).toEqual("success");
      const junction = results.getJunction("j1") as JunctionSimulation;
      expect(junction.pressure).toBeCloseTo(8);
      expect(junction.head).toBeCloseTo(10);
    });

    it("can read valve values", async () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir("r1")
        .aJunction("j1", { demand: 1 })
        .aValve("v1", { startNodeId: "r1", endNodeId: "j1" })
        .build();
      const inp = buildInp(hydraulicModel, defaultSimulationSettings);

      const { status, results } = await runSimulation(inp);

      expect(status).toEqual("success");
      const valve = results.getValve("v1") as ValveSimulation;
      expect(valve.flow).toBeCloseTo(0.999);
      expect(valve.velocity).toBeCloseTo(0.014);
      expect(valve.headloss).toBeCloseTo(0);
      expect(valve.status).toEqual("active");
    });

    it("can read closed status", async () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir("r1")
        .aJunction("j1", { demand: 1 })
        .aValve("v1", {
          startNodeId: "r1",
          endNodeId: "j1",
          initialStatus: "closed",
        })
        .build();
      const inp = buildInp(hydraulicModel, defaultSimulationSettings);

      const { status, results } = await runSimulation(inp);

      expect(status).toEqual("warning");
      const valve = results.getValve("v1") as ValveSimulation;
      expect(valve.status).toEqual("closed");
    });

    it("provides null values when failed", async () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir("r1")
        .aJunction("j1", { demand: 1 })
        .aJunction("j2")
        .aPipe("p1", { startNodeId: "r1", endNodeId: "j1" })
        .build();
      const inp = buildInp(hydraulicModel, defaultSimulationSettings);

      const { status, results } = await runSimulation(inp);

      expect(status).toEqual("failure");
      expect(results.getJunction("j1")).toBeNull();
      expect(results.getPipe("p1")).toBeNull();
    });
  });

  const wireWebWorker = () => {
    (lib.runSimulation as unknown as Mock).mockImplementation(
      workerRunSimulation,
    );
  };
});

describe("valve status", () => {
  it("computes the valve status from epanet", () => {
    const partiallyOpenCode = 4;
    expect(valveStatusFor(partiallyOpenCode).status).toEqual("active");
  });

  it("assumes closed when code is less than 3", () => {
    expect(valveStatusFor(2).status).toEqual("closed");
    expect(valveStatusFor(1).status).toEqual("closed");
    expect(valveStatusFor(0).status).toEqual("closed");
  });

  it("considers open when code 3", () => {
    expect(valveStatusFor(3).status).toEqual("open");
  });

  it("appends a warning to open statuses", () => {
    expect(valveStatusFor(6).status).toEqual("open");
    expect(valveStatusFor(6).warning).toEqual("cannot-deliver-flow");
    expect(valveStatusFor(7).status).toEqual("open");
    expect(valveStatusFor(7).warning).toEqual("cannot-deliver-pressure");
  });
});

describe("pump status", () => {
  it("detects when cannot deliver head", () => {
    const { status, warning } = pumpStatusFor(0);
    expect(status).toEqual("off");
    expect(warning).toEqual("cannot-deliver-head");
  });

  it("detects when cannot delivery flow", () => {
    const { status, warning } = pumpStatusFor(5);
    expect(status).toEqual("on");
    expect(warning).toEqual("cannot-deliver-flow");
  });

  it("considers off when less than 3", () => {
    const { status, warning } = pumpStatusFor(2);
    expect(status).toEqual("off");
    expect(warning).toBeUndefined();
  });

  it("considers on when greater or equal to 3", () => {
    expect(pumpStatusFor(3).status).toEqual("on");
    expect(pumpStatusFor(3).warning).toBeUndefined();
    expect(pumpStatusFor(4).status).toEqual("on");
    expect(pumpStatusFor(4).warning).toBeUndefined();
    expect(pumpStatusFor(7).status).toEqual("on");
    expect(pumpStatusFor(7).warning).toBeUndefined();
  });
});
