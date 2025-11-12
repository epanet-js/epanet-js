import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { runContainedAssetsQuery } from "./run-contained-assets-query";
import { Position } from "src/types";

const IDS = {
  J1: 1,
  J2: 2,
  J3: 3,
  P1: 10,
} as const;

describe("runQuery", () => {
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

      const result = await runContainedAssetsQuery(
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
