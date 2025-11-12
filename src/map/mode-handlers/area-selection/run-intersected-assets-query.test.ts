import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { runIntersectedAssetsQuery } from "./run-intersected-assets-query";
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
    "returns intersected assets in hydraulic model ($label)",
    async ({ runInWorker }) => {
      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build();

      const rectangle: Position[] = [
        [-1, -1],
        [5, -1],
        [5, 1],
        [-1, 1],
        [-1, -1],
      ];

      const result = await runIntersectedAssetsQuery(
        model,
        rectangle,
        undefined,
        "array",
        runInWorker,
      );

      expect(result).toContain(IDS.J1);
      expect(result).toContain(IDS.P1);
      expect(result).not.toContain(IDS.J2);
    },
  );
});
