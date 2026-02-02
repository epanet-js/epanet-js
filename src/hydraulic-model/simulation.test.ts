import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { ResultsReader, attachSimulation } from "./simulation";
import { Junction, Pipe, Pump, Valve } from "./asset-types";

describe("attach simulation", () => {
  const resultsReader: ResultsReader = {
    getPipe: () => ({
      type: "pipe",
      flow: 20,
      velocity: 5,
      headloss: 10,
      unitHeadloss: 20,
      status: "open",
    }),
    getPump: () => ({
      type: "pump",
      flow: 10,
      headloss: -50,
      status: "off",
      statusWarning: "cannot-deliver-flow",
    }),
    getValve: () => ({
      type: "valve",
      flow: 10,
      headloss: 0.1,
      velocity: 9,
      status: "closed",
      statusWarning: "cannot-deliver-pressure",
    }),
    getJunction: () => ({
      type: "junction",
      pressure: 10,
      head: 8,
      demand: 15,
    }),
    getTank: () => ({
      type: "tank",
      pressure: 10,
      head: 8,
      level: 12,
      volume: 10,
    }),
    getAllPressures: () => [],
    getAllHeads: () => [],
    getAllDemands: () => [],
    getAllFlows: () => [],
    getAllVelocities: () => [],
    getAllUnitHeadlosses: () => [],
  };
  it("sets the simulation for the assets", () => {
    const IDS = { J1: 1, P1: 2, PU1: 3, VALVE1: 4 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aPipe(IDS.P1)
      .aPump(IDS.PU1, { initialStatus: "on" })
      .aValve(IDS.VALVE1, { initialStatus: "active" })
      .build();

    const updatedModel = attachSimulation(hydraulicModel, resultsReader);

    const pipe = updatedModel.assets.get(IDS.P1) as Pipe;
    expect(pipe.flow).toEqual(20);
    expect(pipe.unitHeadloss).toEqual(20);

    const junction = updatedModel.assets.get(IDS.J1) as Junction;
    expect(junction.pressure).toEqual(10);
    expect(junction.head).toEqual(8);
    expect(junction.actualDemand).toEqual(15);

    const pump = updatedModel.assets.get(IDS.PU1) as Pump;
    expect(pump.head).toEqual(50);
    expect(pump.status).toEqual("off");
    expect(pump.statusWarning).toEqual("cannot-deliver-flow");

    const valve = updatedModel.assets.get(IDS.VALVE1) as Valve;
    expect(valve.status).toEqual("closed");
  });

  it("returns a new model with a new assets collection reference", () => {
    const IDS = { J1: 1, P1: 2, PU1: 3 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aPipe(IDS.P1)
      .aPump(IDS.PU1)
      .build();

    const previousAssets = hydraulicModel.assets;

    const updatedModel = attachSimulation(hydraulicModel, resultsReader);

    expect(updatedModel.assets === previousAssets).toBeFalsy();
    expect(updatedModel === hydraulicModel).toBeFalsy();
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
