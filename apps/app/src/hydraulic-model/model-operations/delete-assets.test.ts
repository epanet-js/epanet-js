import { describe, it, expect } from "vitest";
import {
  getJunctionDemands,
  getLinkLevelSetting,
  getLinkTimedSetting,
} from "@epanet-js/hydraulic-model";
import type { ChangeSet, EntityKind } from "@epanet-js/change-set";
import { deleteAssets } from "./delete-assets";
import { applyOperation } from "src/__helpers__/apply-operation";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildTestFactories } from "src/__helpers__/test-factories";
import type { HydraulicModel } from "src/hydraulic-model";

const { labelManager } = buildTestFactories();

const run = (
  hydraulicModel: HydraulicModel,
  data: Parameters<typeof deleteAssets>[1],
) =>
  applyOperation(
    hydraulicModel,
    deleteAssets(hydraulicModel, data),
    labelManager,
  );

const hasRecordFor = (changeSet: ChangeSet, entity: EntityKind) =>
  changeSet.records.some((record) => record.entity === entity);

const updatedIds = (changeSet: ChangeSet) =>
  changeSet.records
    .filter((record) => record.kind === "update")
    .map((record) => record.id);

describe("deleteAssets", () => {
  it("disconnects customer points when deleting pipe", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .aCustomerPoint(IDS.CP1, {
        coordinates: [2, 1],
        connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
      })
      .aCustomerPointDemand(IDS.CP1, [{ baseDemand: 25 }])
      .build();

    run(hydraulicModel, {
      assetIds: [IDS.P1],
      shouldUpdateCustomerPoints: true,
    });

    expect(hydraulicModel.assets.has(IDS.P1)).toBe(false);
    expect(hydraulicModel.assets.has(IDS.J1)).toBe(true);
    const disconnectedCP = hydraulicModel.customerPoints.get(IDS.CP1)!;
    expect(disconnectedCP.coordinates).toEqual([2, 1]);
    expect(disconnectedCP.connection).toBeNull();
  });

  it("disconnects customer points when deleting junction that cascades to pipe deletion", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .aCustomerPoint(IDS.CP1, {
        coordinates: [2, 1],
        connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
      })
      .aCustomerPointDemand(IDS.CP1, [{ baseDemand: 25 }])
      .build();

    run(hydraulicModel, {
      assetIds: [IDS.J1],
      shouldUpdateCustomerPoints: true,
    });

    expect(hydraulicModel.assets.has(IDS.J1)).toBe(false);
    expect(hydraulicModel.assets.has(IDS.P1)).toBe(false);
    expect(hydraulicModel.customerPoints.get(IDS.CP1)!.connection).toBeNull();
  });

  it("does not disconnect customer points by default", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .aCustomerPoint(IDS.CP1, {
        coordinates: [2, 1],
        connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
      })
      .aCustomerPointDemand(IDS.CP1, [{ baseDemand: 25 }])
      .build();

    const { changeSet } = run(hydraulicModel, { assetIds: [IDS.P1] });

    expect(hydraulicModel.assets.has(IDS.P1)).toBe(false);
    expect(hasRecordFor(changeSet, "customerPoint")).toBe(false);
  });

  describe("isActive re-evaluation", () => {
    it("keeps node active when deleting all links", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, P2: 4 } as const;
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
        .aNode(IDS.J1, [0, 0])
        .aNode(IDS.J2, [10, 0])
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: true,
        })
        .aPipe(IDS.P2, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: true,
        })
        .build();

      const { changeSet } = run(hydraulicModel, {
        assetIds: [IDS.P1, IDS.P2],
      });

      expect(updatedIds(changeSet)).toEqual([]);
      expect(hydraulicModel.assets.get(IDS.J1)!.isActive).toBe(true);
      expect(hydraulicModel.assets.get(IDS.J2)!.isActive).toBe(true);
    });

    it("keeps node active when deleting one of two active links", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 } as const;
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
        .aNode(IDS.J1, [0, 0])
        .aNode(IDS.J2, [10, 0])
        .aNode(IDS.J3, [20, 0])
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: true,
        })
        .aPipe(IDS.P2, {
          startNodeId: IDS.J2,
          endNodeId: IDS.J3,
          isActive: true,
        })
        .build();

      const { changeSet } = run(hydraulicModel, { assetIds: [IDS.P1] });

      expect(updatedIds(changeSet)).toEqual([]);
      expect(hydraulicModel.assets.get(IDS.J2)!.isActive).toBe(true);
    });

    it("deactivates node when deleting active link but inactive link remains", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 } as const;
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
        .aNode(IDS.J1, [0, 0])
        .aNode(IDS.J2, [10, 0])
        .aNode(IDS.J3, [20, 0])
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: true,
        })
        .aPipe(IDS.P2, {
          startNodeId: IDS.J2,
          endNodeId: IDS.J3,
          isActive: false,
        })
        .build();

      const { changeSet } = run(hydraulicModel, { assetIds: [IDS.P1] });

      expect(updatedIds(changeSet)).toEqual([IDS.J2]);
      expect(hydraulicModel.assets.get(IDS.J2)!.isActive).toBe(false);
    });

    it("activates orphan nodes when deleting last inactive link", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
        .aJunction(IDS.J1, { coordinates: [0, 0], isActive: false })
        .aJunction(IDS.J2, { coordinates: [10, 0], isActive: false })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: false,
        })
        .build();

      const { changeSet } = run(hydraulicModel, { assetIds: [IDS.P1] });

      expect(updatedIds(changeSet).sort()).toEqual([IDS.J1, IDS.J2]);
      expect(hydraulicModel.assets.get(IDS.J1)!.isActive).toBe(true);
      expect(hydraulicModel.assets.get(IDS.J2)!.isActive).toBe(true);
    });

    it("deactivates appropriate nodes when cascading node deletion removes links", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5, P3: 6 } as const;
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
        .aNode(IDS.J1, [0, 0])
        .aNode(IDS.J2, [10, 0])
        .aNode(IDS.J3, [20, 0])
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: true,
        })
        .aPipe(IDS.P2, {
          startNodeId: IDS.J2,
          endNodeId: IDS.J3,
          isActive: true,
        })
        .aPipe(IDS.P3, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J3,
          isActive: false,
        })
        .build();

      const { changeSet } = run(hydraulicModel, { assetIds: [IDS.J2] });

      expect(updatedIds(changeSet).sort()).toEqual([IDS.J1, IDS.J3]);
      expect(hydraulicModel.assets.get(IDS.J1)!.isActive).toBe(false);
      expect(hydraulicModel.assets.get(IDS.J3)!.isActive).toBe(false);
    });
  });

  describe("demand cleanup", () => {
    it("clears demands for deleted junctions", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunctionDemand(IDS.J1, [{ baseDemand: 50 }, { baseDemand: 30 }])
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build();

      run(hydraulicModel, { assetIds: [IDS.J1] });

      expect(getJunctionDemands(hydraulicModel.demands, IDS.J1)).toEqual([]);
    });

    it("records no demand change when the deleted junction has no demands", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build();

      const { changeSet } = run(hydraulicModel, { assetIds: [IDS.J1] });

      expect(hasRecordFor(changeSet, "junctionDemand")).toBe(false);
    });

    it("records no demand change when deleting non-junction assets", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunctionDemand(IDS.J1, [{ baseDemand: 50 }])
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build();

      const { changeSet } = run(hydraulicModel, { assetIds: [IDS.P1] });

      expect(hasRecordFor(changeSet, "junctionDemand")).toBe(false);
      expect(getJunctionDemands(hydraulicModel.demands, IDS.J1)).toEqual([
        { baseDemand: 50 },
      ]);
    });
  });

  describe("controls cleanup", () => {
    it("removes the control attached to a deleted pump", () => {
      const IDS = { N1: 1, N2: 2, P1: 3, N3: 4, N4: 5, P2: 6 } as const;
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
        .aJunction(IDS.N1)
        .aJunction(IDS.N2)
        .aPump(IDS.P1, { startNodeId: IDS.N1, endNodeId: IDS.N2 })
        .aTimedSettingControl({
          linkId: IDS.P1,
          steps: [{ time: 3600, status: "off", setting: 1 }],
        })
        .aJunction(IDS.N3)
        .aJunction(IDS.N4)
        .aPump(IDS.P2, { startNodeId: IDS.N3, endNodeId: IDS.N4 })
        .aTimedSettingControl({
          linkId: IDS.P2,
          steps: [{ time: 7200, status: "on", setting: 1 }],
        })
        .build();

      run(hydraulicModel, { assetIds: [IDS.P1] });

      expect(getLinkTimedSetting(hydraulicModel.controls, IDS.P1)).toBeNull();
      expect(
        getLinkTimedSetting(hydraulicModel.controls, IDS.P2),
      ).not.toBeNull();
    });

    it("removes a level-setting control when its tank is deleted while the pump survives", () => {
      const IDS = { N1: 1, N2: 2, P1: 3, T1: 4 } as const;
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
        .aJunction(IDS.N1)
        .aJunction(IDS.N2)
        .aPump(IDS.P1, { startNodeId: IDS.N1, endNodeId: IDS.N2 })
        .aTank(IDS.T1)
        .aLevelSettingControl({
          linkId: IDS.P1,
          tankId: IDS.T1,
          on: { level: 1, setting: 1 },
          off: { level: 5 },
        })
        .build();

      run(hydraulicModel, { assetIds: [IDS.T1] });

      expect(hydraulicModel.assets.has(IDS.T1)).toBe(false);
      expect(hydraulicModel.assets.has(IDS.P1)).toBe(true);
      expect(getLinkLevelSetting(hydraulicModel.controls, IDS.P1)).toBeNull();
    });

    it("records no controls change when the deleted asset has no controls", () => {
      const IDS = { N1: 1, N2: 2, P1: 3, J1: 4 } as const;
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
        .aJunction(IDS.N1)
        .aJunction(IDS.N2)
        .aPump(IDS.P1, { startNodeId: IDS.N1, endNodeId: IDS.N2 })
        .aTimedSettingControl({
          linkId: IDS.P1,
          steps: [{ time: 3600, status: "off", setting: 1 }],
        })
        .aJunction(IDS.J1)
        .build();

      const { changeSet } = run(hydraulicModel, { assetIds: [IDS.J1] });

      expect(hasRecordFor(changeSet, "allControls")).toBe(false);
    });

    it("undoes the control removal", () => {
      const IDS = { N1: 1, N2: 2, P1: 3, T1: 4 } as const;
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
        .aJunction(IDS.N1)
        .aJunction(IDS.N2)
        .aPump(IDS.P1, { startNodeId: IDS.N1, endNodeId: IDS.N2 })
        .aTank(IDS.T1)
        .aLevelSettingControl({
          linkId: IDS.P1,
          tankId: IDS.T1,
          on: { level: 1, setting: 1 },
          off: { level: 5 },
        })
        .build();

      const { undo } = run(hydraulicModel, { assetIds: [IDS.T1] });

      expect(getLinkLevelSetting(hydraulicModel.controls, IDS.P1)).toBeNull();
      expect(hydraulicModel.controlsLookup.hasControls(IDS.P1)).toBe(false);
      expect(hydraulicModel.controlsLookup.hasControls(IDS.T1)).toBe(false);

      undo();

      expect(
        getLinkLevelSetting(hydraulicModel.controls, IDS.P1),
      ).not.toBeNull();
      expect(hydraulicModel.controlsLookup.hasControls(IDS.P1)).toBe(true);
      expect(hydraulicModel.controlsLookup.hasControls(IDS.T1)).toBe(true);
      expect(hydraulicModel.assets.has(IDS.T1)).toBe(true);
    });
  });

  describe("raw controls cleanup", () => {
    it("removes a simple control referencing a deleted link", () => {
      const IDS = { N1: 1, N2: 2, P1: 3, T1: 4, P2: 5 } as const;
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
        .aJunction(IDS.N1)
        .aJunction(IDS.N2)
        .aPump(IDS.P1, { startNodeId: IDS.N1, endNodeId: IDS.N2 })
        .aTank(IDS.T1)
        .aPump(IDS.P2, { startNodeId: IDS.N2, endNodeId: IDS.T1 })
        .aSimpleControl({
          template: "LINK {{0}} OPEN IF NODE {{1}} ABOVE 100",
          assetReferences: [
            { assetId: IDS.P1, isActionTarget: true },
            { assetId: IDS.T1 },
          ],
        })
        .aSimpleControl({
          template: "LINK {{0}} CLOSED IF NODE {{1}} BELOW 50",
          assetReferences: [
            { assetId: IDS.P2, isActionTarget: true },
            { assetId: IDS.T1 },
          ],
        })
        .build();

      run(hydraulicModel, {
        assetIds: [IDS.P1],
        shouldRemoveRawControls: true,
      });

      expect(hydraulicModel.rawControls.simple).toHaveLength(1);
      expect(hydraulicModel.rawControls.simple[0].assetReferences).toEqual([
        { assetId: IDS.P2, isActionTarget: true },
        { assetId: IDS.T1, isActionTarget: false },
      ]);
    });

    it("removes a simple control referencing a deleted node", () => {
      const IDS = { N1: 1, N2: 2, P1: 3, T1: 4 } as const;
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
        .aJunction(IDS.N1)
        .aJunction(IDS.N2)
        .aPump(IDS.P1, { startNodeId: IDS.N1, endNodeId: IDS.N2 })
        .aTank(IDS.T1)
        .aSimpleControl({
          template: "LINK {{0}} OPEN IF NODE {{1}} ABOVE 100",
          assetReferences: [
            { assetId: IDS.P1, isActionTarget: true },
            { assetId: IDS.T1 },
          ],
        })
        .build();

      run(hydraulicModel, {
        assetIds: [IDS.T1],
        shouldRemoveRawControls: true,
      });

      expect(hydraulicModel.rawControls.simple).toHaveLength(0);
    });

    it("removes a control whose link is pulled in by deleting a connected node", () => {
      const IDS = { N1: 1, N2: 2, P1: 3, T1: 4 } as const;
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
        .aJunction(IDS.N1)
        .aJunction(IDS.N2)
        .aPump(IDS.P1, { startNodeId: IDS.N1, endNodeId: IDS.N2 })
        .aTank(IDS.T1)
        .aSimpleControl({
          template: "LINK {{0}} OPEN IF NODE {{1}} ABOVE 100",
          assetReferences: [
            { assetId: IDS.P1, isActionTarget: true },
            { assetId: IDS.T1 },
          ],
        })
        .build();

      run(hydraulicModel, {
        assetIds: [IDS.N1],
        shouldRemoveRawControls: true,
      });

      expect(hydraulicModel.assets.has(IDS.N1)).toBe(false);
      expect(hydraulicModel.assets.has(IDS.P1)).toBe(false);
      expect(hydraulicModel.rawControls.simple).toHaveLength(0);
    });

    it("removes a rule referencing a deleted asset", () => {
      const IDS = { N1: 1, N2: 2, P1: 3, T1: 4 } as const;
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
        .aJunction(IDS.N1)
        .aJunction(IDS.N2)
        .aPump(IDS.P1, { startNodeId: IDS.N1, endNodeId: IDS.N2 })
        .aTank(IDS.T1)
        .aRule({
          ruleId: "1",
          template:
            "RULE {{id}}\nIF NODE {{0}} LEVEL > 100\nTHEN LINK {{1}} STATUS IS OPEN",
          assetReferences: [
            { assetId: IDS.T1 },
            { assetId: IDS.P1, isActionTarget: true },
          ],
        })
        .build();

      run(hydraulicModel, {
        assetIds: [IDS.P1],
        shouldRemoveRawControls: true,
      });

      expect(hydraulicModel.rawControls.rules).toHaveLength(0);
    });

    it("keeps controls that only reference surviving assets", () => {
      const IDS = { N1: 1, N2: 2, P1: 3, T1: 4, J1: 5 } as const;
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
        .aJunction(IDS.N1)
        .aJunction(IDS.N2)
        .aPump(IDS.P1, { startNodeId: IDS.N1, endNodeId: IDS.N2 })
        .aTank(IDS.T1)
        .aJunction(IDS.J1)
        .aSimpleControl({
          template: "LINK {{0}} OPEN IF NODE {{1}} ABOVE 100",
          assetReferences: [
            { assetId: IDS.P1, isActionTarget: true },
            { assetId: IDS.T1 },
          ],
        })
        .build();

      const { changeSet } = run(hydraulicModel, {
        assetIds: [IDS.J1],
        shouldRemoveRawControls: true,
      });

      expect(hasRecordFor(changeSet, "rawControls")).toBe(false);
    });

    it("does not touch raw controls when the flag boolean is off", () => {
      const IDS = { N1: 1, N2: 2, P1: 3, T1: 4 } as const;
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
        .aJunction(IDS.N1)
        .aJunction(IDS.N2)
        .aPump(IDS.P1, { startNodeId: IDS.N1, endNodeId: IDS.N2 })
        .aTank(IDS.T1)
        .aSimpleControl({
          template: "LINK {{0}} OPEN IF NODE {{1}} ABOVE 100",
          assetReferences: [
            { assetId: IDS.P1, isActionTarget: true },
            { assetId: IDS.T1 },
          ],
        })
        .build();

      const { changeSet } = run(hydraulicModel, { assetIds: [IDS.P1] });

      expect(hasRecordFor(changeSet, "rawControls")).toBe(false);
      expect(hydraulicModel.rawControls.simple).toHaveLength(1);
    });

    it("undoes the raw control removal", () => {
      const IDS = { N1: 1, N2: 2, P1: 3, T1: 4 } as const;
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
        .aJunction(IDS.N1)
        .aJunction(IDS.N2)
        .aPump(IDS.P1, { startNodeId: IDS.N1, endNodeId: IDS.N2 })
        .aTank(IDS.T1)
        .aSimpleControl({
          template: "LINK {{0}} OPEN IF NODE {{1}} ABOVE 100",
          assetReferences: [
            { assetId: IDS.P1, isActionTarget: true },
            { assetId: IDS.T1 },
          ],
        })
        .build();

      const { undo } = run(hydraulicModel, {
        assetIds: [IDS.T1],
        shouldRemoveRawControls: true,
      });

      expect(hydraulicModel.rawControls.simple).toHaveLength(0);

      undo();

      expect(hydraulicModel.rawControls.simple).toHaveLength(1);
      expect(hydraulicModel.assets.has(IDS.T1)).toBe(true);
    });
  });
});
