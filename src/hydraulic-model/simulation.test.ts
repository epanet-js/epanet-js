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
    }),
  };
  it("sets the simulation for the assets", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("j1")
      .aPipe("p1")
      .aPump("pu1", { initialStatus: "on" })
      .aValve("valve1", { initialStatus: "active" })
      .build();

    attachSimulation(hydraulicModel, resultsReader);

    const pipe = hydraulicModel.assets.get("p1") as Pipe;
    expect(pipe.flow).toEqual(20);
    expect(pipe.unitHeadloss).toEqual(20);

    const junction = hydraulicModel.assets.get("j1") as Junction;
    expect(junction.pressure).toEqual(10);
    expect(junction.head).toEqual(8);

    const pump = hydraulicModel.assets.get("pu1") as Pump;
    expect(pump.head).toEqual(50);
    expect(pump.status).toEqual("off");
    expect(pump.statusWarning).toEqual("cannot-deliver-flow");

    const valve = hydraulicModel.assets.get("valve1") as Valve;
    expect(valve.status).toEqual("closed");
  });

  it("forces a reference change in the assets collection", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("j1")
      .aPipe("p1")
      .aPump("pu1")
      .build();

    const previousAssets = hydraulicModel.assets;

    attachSimulation(hydraulicModel, resultsReader);

    expect(hydraulicModel.assets === previousAssets).toBeFalsy();
  });

  it.skip("is performant", () => {
    const total = 1e5;
    const builder = HydraulicModelBuilder.with();
    for (let i = 0; i < total; i++) {
      builder.aJunction(String(i));
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
