import { describe, it, expect } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildTestFactories } from "src/__helpers__/test-factories";
import {
  modelLabels,
  snapshot,
  withoutIndexOrder,
  type ModelFixture,
} from "src/__helpers__/model-snapshot";
import type { HydraulicModel } from "../hydraulic-model";
import { applyChangeSet } from "./apply";
import { changeSet, type Intent } from "./build";
import {
  dropAssets,
  putAssets,
  replaceControls,
  replaceCurves,
  replaceCustomAttributes,
  replacePatterns,
  setAsset,
  setCustomerPoint,
  setDemands,
  setPipeLibrary,
  setRawControls,
} from "./intents";

const IDS = {
  J1: 1,
  J2: 2,
  P1: 3,
  T1: 4,
  J3: 5,
  CP1: 6,
  C1: 10,
  PAT1: 20,
} as const;

const aNetwork = (): ModelFixture => {
  const { labelManager, assetFactory, idGenerator } = buildTestFactories();
  const model = HydraulicModelBuilder.with({
    labelManager,
    assetFactory,
    idGenerator,
  })
    .aJunction(IDS.J1, { coordinates: [0, 0], elevation: 10 })
    .aJunction(IDS.J2, { coordinates: [10, 0], elevation: 20 })
    .aJunction(IDS.J3, { coordinates: [20, 0], elevation: 30 })
    .aTank(IDS.T1, { coordinates: [30, 0] })
    .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2, diameter: 200 })
    .aCurve({ id: IDS.C1, type: "volume", points: [{ x: 1, y: 1 }] })
    .aPattern(IDS.PAT1, "PAT1", [1, 2, 3])
    .aCustomerPoint(IDS.CP1, {
      coordinates: [5, 1],
      connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
    })
    .aJunctionDemand(IDS.J1, [{ baseDemand: 5 }])
    .build();

  for (const point of model.customerPoints.values()) {
    labelManager.register(point.label, "customerPoint", point.id);
  }

  return { model, labelManager };
};

const roundTrip = (
  name: string,
  intents: (model: HydraulicModel) => Intent[],
) => {
  const original = aNetwork();
  const worked = aNetwork();

  const built = changeSet(worked.model, name, intents(worked.model));
  expect(built.isEmpty).toBe(false);

  const probe = [...modelLabels(original.model), ...modelLabels(worked.model)];

  applyChangeSet(worked.model, built, "forward", worked.labelManager);
  const forward = snapshot(worked, probe);
  expect(forward).not.toEqual(snapshot(original, probe));

  applyChangeSet(worked.model, built, "reverse", worked.labelManager);
  expect(withoutIndexOrder(snapshot(worked, probe))).toEqual(
    withoutIndexOrder(snapshot(original, probe)),
  );

  return worked;
};

describe("model snapshot", () => {
  it("matches an untouched pair and separates a single changed property", () => {
    const a = aNetwork();
    const b = aNetwork();

    expect(snapshot(b)).toEqual(snapshot(a));

    b.model.assets.get(IDS.J1)!.setProperty("elevation", 999);
    expect(snapshot(b)).not.toEqual(snapshot(a));
  });

  it("separates a key set to undefined from one that is absent", () => {
    const a = aNetwork();
    const b = aNetwork();

    b.model.assets.get(IDS.J1)!.setProperty("custom-1", undefined);

    expect(snapshot(b)).not.toEqual(snapshot(a));
  });
});

describe("applyChangeSet", () => {
  it("round-trips an asset property update", () => {
    const worked = roundTrip("changeProperty", () => [
      setAsset(IDS.J1, { elevation: 77 }),
    ]);
    expect(worked.model.assets.get(IDS.J1)!.getProperty("elevation")).toBe(10);
  });

  it("round-trips an asset creation", () => {
    const { assetFactory } = buildTestFactories();
    roundTrip("addNode", () => [
      putAssets([
        assetFactory.createJunction({ id: 99, coordinates: [50, 50] }),
      ]),
    ]);
  });

  it("round-trips a link deletion, restoring topology", () => {
    const worked = roundTrip("deleteAssets", () => [dropAssets([IDS.P1])]);
    expect(worked.model.topology.getNodes(IDS.P1)).toEqual([IDS.J1, IDS.J2]);
  });

  it("round-trips a node deletion", () => {
    roundTrip("deleteAssets", () => [dropAssets([IDS.J3])]);
  });

  it("round-trips a label change without leaking the old label", () => {
    const worked = roundTrip("changeLabel", () => [
      setAsset(IDS.J1, { label: "RENAMED" }),
    ]);
    expect(worked.labelManager.count("RENAMED")).toBe(0);
  });

  it("round-trips a link reconnection", () => {
    const worked = roundTrip("reverseLink", (model) => {
      const pipe = model.assets.get(IDS.P1)!.copy();
      pipe.setProperty("connections", [IDS.J2, IDS.J1]);
      return [putAssets([pipe])];
    });
    expect(worked.model.topology.getNodes(IDS.P1)).toEqual([IDS.J1, IDS.J2]);
  });

  it("round-trips a customer point property change", () => {
    roundTrip("changeCustomerPointLabel", () => [
      setCustomerPoint(IDS.CP1, { label: "CP-RENAMED" }),
    ]);
  });

  it("round-trips a curve replacement", () => {
    roundTrip("changeCurves", (model) => {
      const next = new Map(model.curves);
      next.set(99, { id: 99, label: "C99", type: "volume", points: [] });
      next.delete(IDS.C1);
      return [replaceCurves(next)];
    });
  });

  it("round-trips a pattern replacement", () => {
    roundTrip("changePatterns", (model) => {
      const next = new Map(model.patterns);
      next.set(99, { id: 99, label: "P99", multipliers: [9] });
      return [replacePatterns(next)];
    });
  });

  it("round-trips a control replacement", () => {
    roundTrip("changeAssetControl", () => [
      replaceControls([
        {
          id: "ctl-1",
          type: "timed-setting",
          linkId: IDS.P1,
          steps: [{ time: 0, status: "on", setting: 1 }],
        },
      ]),
    ]);
  });

  it("round-trips a custom attributes definition change", () => {
    roundTrip("changeCustomAttributesDefinition", () => [
      replaceCustomAttributes(
        new Map([
          [
            "junction" as const,
            new Map([
              ["custom-1", { id: "custom-1", label: "Zone", type: "text" }],
            ]),
          ],
        ]),
      ),
    ]);
  });

  it("round-trips a demand assignment", () => {
    roundTrip("changeDemandAssignment", () => [
      setDemands([{ junctionId: IDS.J1, demands: [{ baseDemand: 42 }] }]),
    ]);
  });

  it("round-trips clearing a demand assignment", () => {
    roundTrip("changeDemandAssignment", () => [
      setDemands([{ junctionId: IDS.J1, demands: [] }]),
    ]);
  });

  it("round-trips the pipe library", () => {
    roundTrip("changePipeMaterials", () => [
      setPipeLibrary([{ label: "PVC", entries: [{ age: 0, roughness: 140 }] }]),
    ]);
  });

  it("round-trips raw controls", () => {
    roundTrip("changeRawControls", () => [
      setRawControls({
        simple: [{ template: "LINK 3 OPEN", assetReferences: [] }],
        rules: [],
      }),
    ]);
  });

  it("reports what it touched", () => {
    const fixture = aNetwork();
    const built = changeSet(fixture.model, "changeProperty", [
      setAsset(IDS.J1, { elevation: 77 }),
      setDemands([{ junctionId: IDS.J1, demands: [{ baseDemand: 1 }] }]),
    ]);

    const report = applyChangeSet(
      fixture.model,
      built,
      "forward",
      fixture.labelManager,
    );

    expect(report.direction).toBe("forward");
    expect(report.name).toBe("changeProperty");
    expect([...report.touchedEntities].sort()).toEqual([
      "junction",
      "junctionDemand",
    ]);
    expect(report.touchedAssetIds).toEqual([IDS.J1]);
  });

  it("ignores a record whose entity is no longer in the model", () => {
    const fixture = aNetwork();
    const built = changeSet(fixture.model, "changeProperty", [
      setAsset(IDS.J1, { elevation: 77 }),
    ]);
    fixture.model.assets.delete(IDS.J1);

    expect(() =>
      applyChangeSet(fixture.model, built, "forward", fixture.labelManager),
    ).not.toThrow();
  });
});
