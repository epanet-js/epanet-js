import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { ResultsReader, attachSimulation } from "./simulation";
import { Junction, Pipe, Pump } from "./asset-types";

describe("attach simulation", () => {
  it("sets the simulation for the assets", () => {
    const resultsReader: ResultsReader = {
      getPressure: () => 10,
      getFlow: () => 20,
      getVelocity: () => 5,
      getHeadloss: () => -50,
    };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("j1")
      .aPipe("p1")
      .aPump("pu1")
      .build();

    attachSimulation(hydraulicModel, resultsReader);

    const pipe = hydraulicModel.assets.get("p1") as Pipe;
    expect(pipe.flow).toEqual(20);

    const junction = hydraulicModel.assets.get("j1") as Junction;
    expect(junction.pressure).toEqual(10);

    const pump = hydraulicModel.assets.get("pu1") as Pump;
    expect(pump.head).toEqual(50);
  });

  it("forces a reference change in the assets collection", () => {
    const resultsReader: ResultsReader = {
      getPressure: () => 10,
      getFlow: () => 20,
      getVelocity: () => 5,
      getHeadloss: () => 50,
    };
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
    const resultsReader: ResultsReader = {
      getPressure: () => 10,
      getFlow: () => 20,
      getVelocity: () => 5,
      getHeadloss: () => 50,
    };
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
