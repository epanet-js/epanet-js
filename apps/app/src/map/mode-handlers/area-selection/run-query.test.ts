import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { runQuery } from "./run-query";
import { FakeSpatialQueryWorker } from "src/__helpers__/spatial-query-worker";
import * as workerInfra from "src/infra/worker";
import { Position } from "src/types";

const IDS = {
  J1: 1,
  J2: 2,
  J3: 3,
  P1: 10,
  CP_INSIDE: 100,
  CP_OUTSIDE: 101,
  ZONE_CROSSED: 200,
  ZONE_OUTSIDE: 201,
} as const;

const aZone = (id: number, ring: Position[]) => ({
  id,
  label: `Z${id}`,
  geometry: { type: "MultiPolygon" as const, coordinates: [[ring]] },
  bbox: [0, 0, 0, 0] as [number, number, number, number],
});

const buildModel = () =>
  HydraulicModelBuilder.with()
    .aJunction(IDS.J1, { coordinates: [0, 0] })
    .aJunction(IDS.J2, { coordinates: [10, 0] })
    .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
    .aJunction(IDS.J3, { coordinates: [20, 20] })
    .aCustomerPoint(IDS.CP_INSIDE, { coordinates: [5, 0] })
    .aCustomerPoint(IDS.CP_OUTSIDE, { coordinates: [50, 50] })
    .aZone(
      aZone(IDS.ZONE_CROSSED, [
        [5, -5],
        [15, -5],
        [15, 5],
        [5, 5],
        [5, -5],
      ]),
    )
    .aZone(
      aZone(IDS.ZONE_OUTSIDE, [
        [40, 40],
        [45, 40],
        [45, 45],
        [40, 45],
        [40, 40],
      ]),
    )
    .build();

const rectangle: Position[] = [
  [-1, -1],
  [11, -1],
  [11, 1],
  [-1, 1],
  [-1, -1],
];

describe("runQuery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    { canUseWorker: false, label: "non-encoded in-process query (no worker)" },
    { canUseWorker: true, label: "encoded worker query" },
  ])(
    "returns contained assets, customer points and zones ($label)",
    async ({ canUseWorker }) => {
      vi.spyOn(workerInfra, "canUseWorker").mockReturnValue(canUseWorker);
      if (canUseWorker) {
        vi.stubGlobal("Worker", FakeSpatialQueryWorker);
      }

      const { assetIds, customerPointIds, zoneIds } = await runQuery(
        buildModel(),
        rectangle,
        undefined,
        "array",
        true,
        true,
      );

      expect(assetIds).toContain(IDS.J1);
      expect(assetIds).toContain(IDS.J2);
      expect(assetIds).toContain(IDS.P1);
      expect(assetIds).not.toContain(IDS.J3);
      expect(customerPointIds).toContain(IDS.CP_INSIDE);
      expect(customerPointIds).not.toContain(IDS.CP_OUTSIDE);
      expect(zoneIds).toEqual([IDS.ZONE_CROSSED]);
    },
  );

  it("excludes customer points when includeCustomerPoints is false", async () => {
    vi.spyOn(workerInfra, "canUseWorker").mockReturnValue(false);

    const { assetIds, customerPointIds } = await runQuery(
      buildModel(),
      rectangle,
      undefined,
      "array",
      false,
    );

    expect(assetIds).toContain(IDS.J1);
    expect(customerPointIds).toEqual([]);
  });

  it("excludes zones unless includeZones is true", async () => {
    vi.spyOn(workerInfra, "canUseWorker").mockReturnValue(false);

    const { zoneIds } = await runQuery(buildModel(), rectangle);

    expect(zoneIds).toEqual([]);
  });
});
