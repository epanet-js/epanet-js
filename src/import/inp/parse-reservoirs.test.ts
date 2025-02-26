import { Reservoir } from "src/hydraulic-model";
import { parseInp } from "./parse-inp";

describe("parse reservoirs", () => {
  it("includes reservoirs in the model", () => {
    const reservoirId = "r1";
    const head = 100;
    const lat = 10;
    const lng = 20;
    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${head}

    [COORDINATES]
    ${reservoirId}\t${lng}\t${lat}

    `;

    const { hydraulicModel } = parseInp(inp);

    const reservoir = hydraulicModel.assets.get(reservoirId) as Reservoir;
    expect(reservoir.id).toEqual(reservoirId);
    expect(reservoir.head).toEqual(head);
    expect(reservoir.coordinates).toEqual([20, 10]);
  });

  it("can get the head using a pattern", () => {
    const reservoirId = "r1";
    const baseHead = 100;
    const lat = 10;
    const lng = 20;
    const patternId = "P_1";
    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${baseHead}\t${patternId}

    [PATTERNS]
    P_1\t14\t12\t19

    [COORDINATES]
    ${reservoirId}\t${lng}\t${lat}

    `;

    const { hydraulicModel } = parseInp(inp);

    const reservoir = hydraulicModel.assets.get(reservoirId) as Reservoir;
    expect(reservoir.id).toEqual(reservoirId);
    expect(reservoir.head).toEqual(1400);
    expect(reservoir.coordinates).toEqual([20, 10]);
  });

  it("tolerates references with different case", () => {
    const baseHead = 100;
    const lat = 10;
    const lng = 20;
    const inp = `
    [RESERVOIRS]
    r1\t${baseHead}\tp_1

    [PATTERNS]
    P_1\t14\t12\t19

    [COORDINATES]
    R1\t${lng}\t${lat}

    `;

    const { hydraulicModel } = parseInp(inp);

    const reservoir = hydraulicModel.assets.get("r1") as Reservoir;
    expect(reservoir.id).toEqual("r1");
    expect(reservoir.head).toEqual(1400);
    expect(reservoir.coordinates).toEqual([20, 10]);
  });
});
