import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { runZoneContentsQuery } from "./zone-contents";
import * as workerInfra from "src/infra/worker";
import { FakeSpatialQueryWorker } from "src/__helpers__/spatial-query-worker";
import { Position } from "src/types";

const IDS = {
  J1: 1,
  J2: 2,
  P1: 10,
  CP_INSIDE: 100,
  CP_OUTSIDE: 101,
  ZONE: 200,
  ZONE_EMPTY: 201,
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
    .aCustomerPoint(IDS.CP_INSIDE, { coordinates: [8, 0] })
    .aCustomerPoint(IDS.CP_OUTSIDE, { coordinates: [50, 50] })
    .aZone(
      aZone(IDS.ZONE, [
        [5, -5],
        [15, -5],
        [15, 5],
        [5, 5],
        [5, -5],
      ]),
    )
    .aZone(
      aZone(IDS.ZONE_EMPTY, [
        [40, 40],
        [45, 40],
        [45, 45],
        [40, 45],
        [40, 40],
      ]),
    )
    .build();

describe("runZoneContentsQuery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    { canUseWorker: false, label: "in-process" },
    { canUseWorker: true, label: "worker" },
  ])(
    "returns the assets and customer points inside the zones ($label)",
    async ({ canUseWorker }) => {
      vi.spyOn(workerInfra, "canUseWorker").mockReturnValue(canUseWorker);
      if (canUseWorker) {
        vi.stubGlobal("Worker", FakeSpatialQueryWorker);
      }

      const { assetIds, customerPointIds } = await runZoneContentsQuery(
        buildModel(),
        [IDS.ZONE, IDS.ZONE_EMPTY],
      );

      expect(assetIds).toEqual([IDS.J2]);
      expect(customerPointIds).toEqual([IDS.CP_INSIDE]);
    },
  );

  it("excludes customer points when includeCustomerPoints is false", async () => {
    vi.spyOn(workerInfra, "canUseWorker").mockReturnValue(false);

    const { assetIds, customerPointIds } = await runZoneContentsQuery(
      buildModel(),
      [IDS.ZONE],
      false,
    );

    expect(assetIds).toEqual([IDS.J2]);
    expect(customerPointIds).toEqual([]);
  });
});
