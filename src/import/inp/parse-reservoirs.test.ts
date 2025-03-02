import { Asset, AssetsMap, Reservoir } from "src/hydraulic-model";
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

    const reservoir = getByLabel(
      hydraulicModel.assets,
      reservoirId,
    ) as Reservoir;
    expect(reservoir.id).not.toBeUndefined();
    expect(reservoir.id).not.toEqual(reservoirId);
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

    const reservoir = getByLabel(
      hydraulicModel.assets,
      reservoirId,
    ) as Reservoir;
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

    const reservoir = getByLabel(hydraulicModel.assets, "r1") as Reservoir;
    expect(reservoir.head).toEqual(1400);
    expect(reservoir.coordinates).toEqual([20, 10]);
  });

  const getByLabel = (assets: AssetsMap, label: string): Asset | undefined => {
    return [...assets.values()].find((a) => a.label === label);
  };
});
