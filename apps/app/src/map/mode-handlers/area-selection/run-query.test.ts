import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { runQueryDeprecated, runQueryNew } from "./run-query";
import { Position } from "src/types";

const IDS = {
  J1: 1,
  J2: 2,
  J3: 3,
  P1: 10,
  CP_INSIDE: 100,
  CP_OUTSIDE: 101,
} as const;

describe("runQueryDeprecated", () => {
  it.each([
    { runInWorker: false, label: "sync run" },
    { runInWorker: true, label: "worker run" },
  ])(
    "returns contained assets in hydraulic model ($label)",
    async ({ runInWorker }) => {
      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .aJunction(IDS.J3, { coordinates: [20, 20] })
        .build();

      const rectangle: Position[] = [
        [-1, -1],
        [11, -1],
        [11, 1],
        [-1, 1],
        [-1, -1],
      ];

      const result = await runQueryDeprecated(
        model,
        rectangle,
        undefined,
        "array",
        runInWorker,
      );

      expect(result).toContain(IDS.J1);
      expect(result).toContain(IDS.J2);
      expect(result).toContain(IDS.P1);
      expect(result).not.toContain(IDS.J3);
    },
  );
});

describe("runQueryNew", () => {
  it("returns contained assets and customer points", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aJunction(IDS.J3, { coordinates: [20, 20] })
      .aCustomerPoint(IDS.CP_INSIDE, { coordinates: [5, 0] })
      .aCustomerPoint(IDS.CP_OUTSIDE, { coordinates: [50, 50] })
      .build();

    const rectangle: Position[] = [
      [-1, -1],
      [11, -1],
      [11, 1],
      [-1, 1],
      [-1, -1],
    ];

    const { assetIds, customerPointIds } = await runQueryNew(model, rectangle);

    expect(assetIds).toContain(IDS.J1);
    expect(assetIds).toContain(IDS.J2);
    expect(assetIds).toContain(IDS.P1);
    expect(assetIds).not.toContain(IDS.J3);
    expect(customerPointIds).toContain(IDS.CP_INSIDE);
    expect(customerPointIds).not.toContain(IDS.CP_OUTSIDE);
  });
});
