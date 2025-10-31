import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { lib } from "src/lib/worker";
import { buildInp } from "../build-inp";
import { runSimulation } from "./main";
import { runSimulation as workerRunSimulation } from "./worker";
import { Mock } from "vitest";
import {
  JunctionSimulation,
  ValveSimulation,
  TankSimulation,
} from "../results-reader";
import { pumpStatusFor, valveStatusFor } from "./extract-simulation-results";

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
    const IDS = { R1: 1, J1: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1)
      .aJunction(IDS.J1)
      .aPipe(IDS.P1, { startNodeId: String(IDS.R1), endNodeId: String(IDS.J1) })
      .build();
    const inp = buildInp(hydraulicModel);

    const { status, report } = await runSimulation(inp);

    expect(status).toEqual("success");
    expect(report).not.toContain("Error");
  });

  it("reports says when simulation fails", async () => {
    const IDS = { R1: 1, R2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1)
      .aReservoir(IDS.R2)
      .aPipe(IDS.P1, { startNodeId: String(IDS.R1), endNodeId: String(IDS.R2) })
      .build();
    const inp = buildInp(hydraulicModel);
    const { status, report } = await runSimulation(inp);

    expect(status).toEqual("failure");
    expect(report).toContain("Error 223: not enough nodes");
  });

  it("report says when simulation has warnings", async () => {
    const IDS = { R1: 1, J1: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1, { head: 0 })
      .aJunction(IDS.J1, { baseDemand: 10 })
      .aPipe(IDS.P1, { startNodeId: String(IDS.R1), endNodeId: String(IDS.J1) })
      .build();
    const inp = buildInp(hydraulicModel);

    const { status, report } = await runSimulation(inp, { FLAG_WARNING: true });

    expect(status).toEqual("warning");
    expect(report).toContain("WARNING");
  });

  it("can include multiple errors in the report", async () => {
    const IDS = { R1: 1, J1: 2, P1: 3, J2: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1)
      .aJunction(IDS.J1)
      .aPipe(IDS.P1, { startNodeId: String(IDS.R1), endNodeId: String(IDS.J1) })
      .aJunction(IDS.J2)
      .build();
    const inp = buildInp(hydraulicModel);
    const { status, report } = await runSimulation(inp);

    expect(status).toEqual("failure");
    expect(report.match(/Error 234/gi)!.length).toEqual(1);
    expect(report).toContain("4");
    expect(report).toContain("Error 200");
  });

  describe("results reader", () => {
    it("can read simulation values", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1)
        .aJunction(IDS.J1, { baseDemand: 1 })
        .aPipe(IDS.P1, {
          startNodeId: String(IDS.R1),
          endNodeId: String(IDS.J1),
        })
        .build();
      const inp = buildInp(hydraulicModel);

      const { status, results } = await runSimulation(inp);

      expect(status).toEqual("success");
      expect(results.getJunction(String(IDS.J1))!.pressure).toBeCloseTo(10);
      expect(results.getPipe(String(IDS.P1))!.flow).toBeCloseTo(1);
      expect(results.getPipe(String(IDS.P1))!.velocity).toBeCloseTo(0.014);
    });

    it("can read junction values", async () => {
      const IDS = { R1: 1, J1: 2, V1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 10 })
        .aJunction(IDS.J1, { baseDemand: 1, elevation: 2 })
        .aValve(IDS.V1, {
          startNodeId: String(IDS.R1),
          endNodeId: String(IDS.J1),
        })
        .build();
      const inp = buildInp(hydraulicModel);

      const { status, results } = await runSimulation(inp);

      expect(status).toEqual("success");
      const junction = results.getJunction(
        String(IDS.J1),
      ) as JunctionSimulation;
      expect(junction.pressure).toBeCloseTo(8);
      expect(junction.head).toBeCloseTo(10);
    });

    it("can read valve values", async () => {
      const IDS = { R1: 1, J1: 2, V1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1)
        .aJunction(IDS.J1, { baseDemand: 1 })
        .aValve(IDS.V1, {
          startNodeId: String(IDS.R1),
          endNodeId: String(IDS.J1),
        })
        .build();
      const inp = buildInp(hydraulicModel);

      const { status, results } = await runSimulation(inp);

      expect(status).toEqual("success");
      const valve = results.getValve(String(IDS.V1)) as ValveSimulation;
      expect(valve.flow).toBeCloseTo(0.999);
      expect(valve.velocity).toBeCloseTo(0.014);
      expect(valve.headloss).toBeCloseTo(0);
      expect(valve.status).toEqual("active");
    });

    it("can read tank values", async () => {
      const IDS = { R1: 1, T1: 2, J1: 3, P1: 4, P2: 5 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 120 })
        .aTank(IDS.T1, {
          elevation: 100,
          initialLevel: 15,
          minLevel: 5,
          maxLevel: 25,
          diameter: 120,
          minVolume: 14,
        })
        .aJunction(IDS.J1, { baseDemand: 1 })
        .aPipe(IDS.P1, {
          startNodeId: String(IDS.R1),
          endNodeId: String(IDS.T1),
        })
        .aPipe(IDS.P2, {
          startNodeId: String(IDS.T1),
          endNodeId: String(IDS.J1),
        })
        .build();
      const inp = buildInp(hydraulicModel);

      const { status, results } = await runSimulation(inp);

      expect(status).toEqual("success");
      const tank = results.getTank(String(IDS.T1)) as TankSimulation;
      expect(tank.pressure).toBeGreaterThan(0);
      expect(tank.head).toBeGreaterThan(100);
      expect(tank.level).toBeGreaterThan(0);
      expect(tank.volume).toBeGreaterThan(0);
    });

    it("can read closed status", async () => {
      const IDS = { R1: 1, J1: 2, V1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1)
        .aJunction(IDS.J1, { baseDemand: 1 })
        .aValve(IDS.V1, {
          startNodeId: String(IDS.R1),
          endNodeId: String(IDS.J1),
          initialStatus: "closed",
        })
        .build();
      const inp = buildInp(hydraulicModel);

      const { status, results } = await runSimulation(inp);

      expect(status).toEqual("warning");
      const valve = results.getValve(String(IDS.V1)) as ValveSimulation;
      expect(valve.status).toEqual("closed");
    });

    it("provides null values when failed", async () => {
      const IDS = { R1: 1, J1: 2, J2: 3, P1: 4 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1)
        .aJunction(IDS.J1, { baseDemand: 1 })
        .aJunction(IDS.J2)
        .aPipe(IDS.P1, {
          startNodeId: String(IDS.R1),
          endNodeId: String(IDS.J1),
        })
        .build();
      const inp = buildInp(hydraulicModel);

      const { status, results } = await runSimulation(inp);

      expect(status).toEqual("failure");
      expect(results.getJunction(String(IDS.J1))).toBeNull();
      expect(results.getPipe(String(IDS.P1))).toBeNull();
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
