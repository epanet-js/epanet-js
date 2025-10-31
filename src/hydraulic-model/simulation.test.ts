import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { ResultsReader, attachSimulation } from "./simulation";
import { Junction, Pipe, Pump, Valve } from "./asset-types";

describe("attach simulation", () => {
  const resultsReader: ResultsReader = {
    getPipe: () => ({
      flow: 20,
      velocity: 5,
      headloss: 10,
      unitHeadloss: 20,
      status: "open",
    }),
    getPump: () => ({
      flow: 10,
      headloss: -50,
      status: "off",
      statusWarning: "cannot-deliver-flow",
    }),
    getValve: () => ({
      flow: 10,
      headloss: 0.1,
      velocity: 9,
      status: "closed",
      statusWarning: "cannot-deliver-pressure",
    }),
    getJunction: () => ({
      pressure: 10,
      head: 8,
      demand: 15,
    }),
    getTank: () => ({
      pressure: 10,
      head: 8,
      elevation: 15,
      level: 12,
      volume: 10,
    }),
  };
  it("sets the simulation for the assets", () => {
    const IDS = { J1: 1, P1: 2, PU1: 3, VALVE1: 4 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aPipe(IDS.P1)
      .aPump(IDS.PU1, { initialStatus: "on" })
      .aValve(IDS.VALVE1, { initialStatus: "active" })
      .build();

    attachSimulation(hydraulicModel, resultsReader);

    const pipe = hydraulicModel.assets.get(String(IDS.P1)) as Pipe;
    expect(pipe.flow).toEqual(20);
    expect(pipe.unitHeadloss).toEqual(20);

    const junction = hydraulicModel.assets.get(String(IDS.J1)) as Junction;
    expect(junction.pressure).toEqual(10);
    expect(junction.head).toEqual(8);
    expect(junction.actualDemand).toEqual(15);

    const pump = hydraulicModel.assets.get(String(IDS.PU1)) as Pump;
    expect(pump.head).toEqual(50);
    expect(pump.status).toEqual("off");
    expect(pump.statusWarning).toEqual("cannot-deliver-flow");

    const valve = hydraulicModel.assets.get(String(IDS.VALVE1)) as Valve;
    expect(valve.status).toEqual("closed");
  });

  it("forces a reference change in the assets collection", () => {
    const IDS = { J1: 1, P1: 2, PU1: 3 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aPipe(IDS.P1)
      .aPump(IDS.PU1)
      .build();

    const previousAssets = hydraulicModel.assets;

    attachSimulation(hydraulicModel, resultsReader);

    expect(hydraulicModel.assets === previousAssets).toBeFalsy();
  });

  it.skip("is performant", () => {
    const total = 1e5;
    const builder = HydraulicModelBuilder.with();
    for (let i = 0; i < total; i++) {
      builder.aJunction(i);
    }
    const hydraulicModel = builder.build();

    const start = performance.now();
    attachSimulation(hydraulicModel, resultsReader);
    // eslint-disable-next-line no-console
    console.log(
      `Time spent to attach simulation: ${(performance.now() - start).toFixed(2)}ms`,
    );
  });
});
