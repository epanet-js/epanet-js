import { buildJunction } from "../../__helpers__/hydraulic-model-builder";
import { JunctionSimulationProvider } from "./junction";

describe("Junction", () => {
  it("some basic operations with junction", () => {
    const junction = buildJunction({ id: "ID", coordinates: [1, 2] });

    expect(junction.elevation).toEqual(0);

    junction.setElevation(10);
    expect(junction.elevation).toEqual(10);

    const junctionCopy = junction.copy();
    junctionCopy.setElevation(20);

    expect(junctionCopy.elevation).toEqual(20);
    expect(junction.elevation).toEqual(10);
  });

  it("assigns default values", () => {
    const junction = buildJunction();

    expect(junction.elevation).toEqual(0);
    expect(junction.demand).toEqual(0);
    expect(junction.id).not.toBeUndefined();
  });

  it("can assign values", () => {
    const junction = buildJunction({
      demand: 10,
      elevation: 100,
    });

    expect(junction.demand).toEqual(10);
    expect(junction.elevation).toEqual(100);
  });

  it("can attach a simulation", () => {
    const junction = buildJunction();
    expect(junction.pressure).toBeNull();

    const simulation: JunctionSimulationProvider = {
      getPressure: (_) => 10,
    };
    junction.setSimulation(simulation);

    expect(junction.pressure).toEqual(10);
  });
});
