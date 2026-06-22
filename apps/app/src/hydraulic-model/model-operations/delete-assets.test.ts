import { describe, it, expect } from "vitest";
import {
  getLinkLevelSetting,
  getLinkTimedSetting,
} from "@epanet-js/hydraulic-model";
import { deleteAssets } from "./delete-assets";
import { applyMomentToModel } from "../mutations/apply-moment";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildTestFactories } from "src/__helpers__/test-factories";

describe("deleteAssets", () => {
  it("disconnects customer points when deleting pipe", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
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

    const { deleteAssets: deletedAssetIds, putCustomerPoints } = deleteAssets(
      hydraulicModel,
      {
        assetIds: [IDS.P1],
        shouldUpdateCustomerPoints: true,
      },
    );

    expect(deletedAssetIds).toEqual([IDS.P1]);
    expect(putCustomerPoints).toBeDefined();
    expect(putCustomerPoints!.length).toBe(1);

    const disconnectedCP = putCustomerPoints![0];
    expect(disconnectedCP.id).toBe(IDS.CP1);
    expect(disconnectedCP.coordinates).toEqual([2, 1]);
    expect(disconnectedCP.connection).toBeNull();
  });

  it("disconnects customer points when deleting junction that cascades to pipe deletion", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
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

    const { deleteAssets: deletedAssetIds, putCustomerPoints } = deleteAssets(
      hydraulicModel,
      {
        assetIds: [IDS.J1],
        shouldUpdateCustomerPoints: true,
      },
    );

    expect(deletedAssetIds).toContain(IDS.J1);
    expect(deletedAssetIds).toContain(IDS.P1);
    expect(putCustomerPoints).toBeDefined();
    expect(putCustomerPoints!.length).toBe(1);

    const disconnectedCP = putCustomerPoints![0];
    expect(disconnectedCP.id).toBe(IDS.CP1);
    expect(disconnectedCP.connection).toBeNull();
  });

  it("does not disconnect customer points by default", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
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

    const { deleteAssets: deletedAssetIds, putCustomerPoints } = deleteAssets(
      hydraulicModel,
      {
        assetIds: [IDS.P1],
      },
    );

    expect(deletedAssetIds).toEqual([IDS.P1]);
    expect(putCustomerPoints).toBeUndefined();
  });

  describe("isActive re-evaluation", () => {
    it("keeps node active when deleting all links", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, P2: 4 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
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

      const { patchAssetsAttributes } = deleteAssets(hydraulicModel, {
        assetIds: [IDS.P1, IDS.P2],
      });

      expect(patchAssetsAttributes).not.toBeDefined();
    });

    it("keeps node active when deleting one of two active links", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
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

      const { patchAssetsAttributes } = deleteAssets(hydraulicModel, {
        assetIds: [IDS.P1],
      });

      expect(patchAssetsAttributes).not.toBeDefined();
    });

    it("deactivates node when deleting active link but inactive link remains", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
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

      const { patchAssetsAttributes } = deleteAssets(hydraulicModel, {
        assetIds: [IDS.P1],
      });

      expect(patchAssetsAttributes).toHaveLength(1);
      expect(patchAssetsAttributes![0]).toEqual({
        id: IDS.J2,
        type: "junction",
        properties: { isActive: false },
      });
    });

    it("activates orphan nodes when deleting last inactive link", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0], isActive: false })
        .aJunction(IDS.J2, { coordinates: [10, 0], isActive: false })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: false,
        })
        .build();

      const { patchAssetsAttributes } = deleteAssets(hydraulicModel, {
        assetIds: [IDS.P1],
      });

      expect(patchAssetsAttributes).toHaveLength(2);
      const patchById = Object.fromEntries(
        patchAssetsAttributes!.map((p) => [p.id, p.properties]),
      );
      expect(patchById[IDS.J1]).toEqual({ isActive: true });
      expect(patchById[IDS.J2]).toEqual({ isActive: true });
    });

    it("deactivates appropriate nodes when cascading node deletion removes links", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5, P3: 6 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
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

      const { patchAssetsAttributes } = deleteAssets(hydraulicModel, {
        assetIds: [IDS.J2],
      });

      expect(patchAssetsAttributes).toHaveLength(2);
      const patchById = Object.fromEntries(
        patchAssetsAttributes!.map((p) => [p.id, p.properties]),
      );
      expect(patchById[IDS.J1]).toEqual({ isActive: false });
      expect(patchById[IDS.J3]).toEqual({ isActive: false });
    });
  });

  describe("demand cleanup", () => {
    it("clears demands for deleted junctions", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunctionDemand(IDS.J1, [{ baseDemand: 50 }, { baseDemand: 30 }])
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build();

      const { putDemands } = deleteAssets(hydraulicModel, {
        assetIds: [IDS.J1],
      });

      expect(putDemands).toEqual({
        assignments: [{ junctionId: IDS.J1, demands: [] }],
      });
    });

    it("does not include putDemands when deleted junction has no demands", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build();

      const { putDemands } = deleteAssets(hydraulicModel, {
        assetIds: [IDS.J1],
      });

      expect(putDemands).toBeUndefined();
    });

    it("does not include putDemands when deleting non-junction assets", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunctionDemand(IDS.J1, [{ baseDemand: 50 }])
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build();

      const { putDemands } = deleteAssets(hydraulicModel, {
        assetIds: [IDS.P1],
      });

      expect(putDemands).toBeUndefined();
    });
  });

  describe("controls cleanup", () => {
    it("removes the control attached to a deleted pump", () => {
      const IDS = { N1: 1, N2: 2, P1: 3, N3: 4, N4: 5, P2: 6 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
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

      const { putControls } = deleteAssets(hydraulicModel, {
        assetIds: [IDS.P1],
      });

      expect(putControls).toBeDefined();
      expect(getLinkTimedSetting(putControls!, IDS.P1)).toBeNull();
      expect(getLinkTimedSetting(putControls!, IDS.P2)).not.toBeNull();
    });

    it("removes a level-setting control when its tank is deleted while the pump survives", () => {
      const IDS = { N1: 1, N2: 2, P1: 3, T1: 4 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
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

      const { deleteAssets: deletedAssetIds, putControls } = deleteAssets(
        hydraulicModel,
        { assetIds: [IDS.T1] },
      );

      expect(deletedAssetIds).toEqual([IDS.T1]);
      expect(putControls).toBeDefined();
      expect(getLinkLevelSetting(putControls!, IDS.P1)).toBeNull();
    });

    it("does not include putControls when the deleted asset has no controls", () => {
      const IDS = { N1: 1, N2: 2, P1: 3, J1: 4 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.N1)
        .aJunction(IDS.N2)
        .aPump(IDS.P1, { startNodeId: IDS.N1, endNodeId: IDS.N2 })
        .aTimedSettingControl({
          linkId: IDS.P1,
          steps: [{ time: 3600, status: "off", setting: 1 }],
        })
        .aJunction(IDS.J1)
        .build();

      const { putControls } = deleteAssets(hydraulicModel, {
        assetIds: [IDS.J1],
      });

      expect(putControls).toBeUndefined();
    });

    it("applies and undoes the control removal through the moment", () => {
      const IDS = { N1: 1, N2: 2, P1: 3, T1: 4 } as const;
      const { labelManager } = buildTestFactories();
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

      const moment = deleteAssets(hydraulicModel, { assetIds: [IDS.T1] });
      const reverse = applyMomentToModel(hydraulicModel, moment, labelManager);

      expect(getLinkLevelSetting(hydraulicModel.controls, IDS.P1)).toBeNull();
      expect(hydraulicModel.controlsLookup.hasControls(IDS.P1)).toBe(false);
      expect(hydraulicModel.controlsLookup.hasControls(IDS.T1)).toBe(false);

      applyMomentToModel(hydraulicModel, reverse, labelManager);

      expect(
        getLinkLevelSetting(hydraulicModel.controls, IDS.P1),
      ).not.toBeNull();
      expect(hydraulicModel.controlsLookup.hasControls(IDS.P1)).toBe(true);
      expect(hydraulicModel.controlsLookup.hasControls(IDS.T1)).toBe(true);
      expect(hydraulicModel.assets.has(IDS.T1)).toBe(true);
    });
  });
});
