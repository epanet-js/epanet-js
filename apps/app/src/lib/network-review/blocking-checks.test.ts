import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import {
  blockingChecks,
  failingRuleIds,
  runBlockingChecks,
  simulationBlockers,
  type BlockingCheckResult,
} from "./blocking-checks";
import { CheckType } from "./types";

const IDS = {
  R1: 1,
  J1: 2,
  P1: 3,
  J2: 4,
  J3: 5,
  P2: 6,
  ORPHAN: 7,
  ORPHAN_TANK: 8,
  ORPHAN_RESERVOIR: 9,
} as const;

const aValidModel = () =>
  HydraulicModelBuilder.with()
    .aReservoir(IDS.R1, { head: 100 })
    .aJunction(IDS.J1, { elevation: 10 })
    .aPipe(IDS.P1, {
      startNodeId: IDS.R1,
      endNodeId: IDS.J1,
      length: 100,
      diameter: 100,
      roughness: 100,
    })
    .build();

// One failure per check: an unconnected junction, a supply-less pair, and a
// pipe with no roughness.
const aModelFailingEveryCheck = () =>
  HydraulicModelBuilder.with()
    .aReservoir(IDS.R1, { head: 100 })
    .aJunction(IDS.J1, { elevation: 10 })
    .aPipe(IDS.P1, {
      startNodeId: IDS.R1,
      endNodeId: IDS.J1,
      length: 100,
      diameter: 100,
      roughness: null,
    })
    .aJunction(IDS.J2, { elevation: 10 })
    .aJunction(IDS.J3, { elevation: 10 })
    .aPipe(IDS.P2, {
      startNodeId: IDS.J2,
      endNodeId: IDS.J3,
      length: 100,
      diameter: 100,
      roughness: 100,
    })
    .aJunction(IDS.ORPHAN, { elevation: 10 })
    .build();

describe("runBlockingChecks", () => {
  it("returns one result per check", async () => {
    const results = await runBlockingChecks(aValidModel());

    expect(results.map((result) => result.check).sort()).toEqual(
      [...blockingChecks].sort(),
    );
    expect(results.every((result) => result.issueCount === 0)).toBe(true);
  });

  it("runs only the checks it was asked for", async () => {
    const results = await runBlockingChecks(aModelFailingEveryCheck(), {
      only: [CheckType.orphanAssets],
    });

    expect(results.map((result) => result.check)).toEqual([
      CheckType.orphanAssets,
    ]);
  });

  it("reports each check as it settles", async () => {
    const settled: BlockingCheckResult[] = [];

    const results = await runBlockingChecks(aModelFailingEveryCheck(), {
      onCheckDone: (result) => settled.push(result),
    });

    expect(settled).toHaveLength(results.length);
    expect(settled.map((result) => result.check).sort()).toEqual(
      results.map((result) => result.check).sort(),
    );
  });

  it("counts unsupplied sub-networks rather than every sub-network", async () => {
    const results = await runBlockingChecks(aModelFailingEveryCheck(), {
      only: [CheckType.connectivityTrace],
    });
    const [connectivity] = results;

    expect(connectivity.items).toHaveLength(2);
    expect(connectivity.issueCount).toEqual(1);
  });

  it("rejects when the signal is already aborted", async () => {
    const abortController = new AbortController();
    abortController.abort();

    await expect(
      runBlockingChecks(aValidModel(), { signal: abortController.signal }),
    ).rejects.toThrow();
  });
});

describe("simulationBlockers", () => {
  const aModelWithOrphanSources = () =>
    HydraulicModelBuilder.with()
      .aReservoir(IDS.R1, { head: 100 })
      .aJunction(IDS.J1, { elevation: 10 })
      .aPipe(IDS.P1, {
        startNodeId: IDS.R1,
        endNodeId: IDS.J1,
        length: 100,
        diameter: 100,
        roughness: 100,
      })
      .aTank(IDS.ORPHAN_TANK)
      .aReservoir(IDS.ORPHAN_RESERVOIR, { head: 100 })
      .build();

  it("does not block on orphan tanks and reservoirs", async () => {
    const model = aModelWithOrphanSources();
    const results = await runBlockingChecks(model, {
      only: [CheckType.orphanAssets],
    });

    expect(results[0].issueCount).toEqual(2);
    expect(failingRuleIds(simulationBlockers(results, model))).toEqual([]);
  });

  it("keeps blocking on the other orphans", async () => {
    const model = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1, { head: 100 })
      .aJunction(IDS.J1, { elevation: 10 })
      .aPipe(IDS.P1, {
        startNodeId: IDS.R1,
        endNodeId: IDS.J1,
        length: 100,
        diameter: 100,
        roughness: 100,
      })
      .aTank(IDS.ORPHAN_TANK)
      .aJunction(IDS.ORPHAN, { elevation: 10 })
      .build();

    const results = await runBlockingChecks(model, {
      only: [CheckType.orphanAssets],
    });
    const [orphans] = simulationBlockers(results, model);

    expect(orphans.items).toEqual([IDS.ORPHAN]);
    expect(orphans.issueCount).toEqual(1);
  });
});

describe("failingRuleIds", () => {
  it("reports topology problems before attribute rules", async () => {
    const results = await runBlockingChecks(aModelFailingEveryCheck());

    expect(failingRuleIds(results)).toEqual([
      "asset.connected",
      "subNetwork.supplySource.present",
      "pipe.roughness.present",
    ]);
  });

  it("skips checks that found nothing", async () => {
    const results = await runBlockingChecks(aValidModel());

    expect(failingRuleIds(results)).toEqual([]);
  });

  it("lists every failing attribute rule, not just the first", async () => {
    const model = HydraulicModelBuilder.with()
      .aPipe(IDS.P1, { roughness: null, diameter: null, length: 100 })
      .build();

    const results = await runBlockingChecks(model, {
      only: [CheckType.modelAttributesValidation],
    });

    expect(failingRuleIds(results)).toEqual(
      expect.arrayContaining([
        "pipe.roughness.present",
        "pipe.diameter.present",
      ]),
    );
  });
});
