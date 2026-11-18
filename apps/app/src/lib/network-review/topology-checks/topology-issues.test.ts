import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import {
  ActiveAssetIndex,
  ActiveTopology,
  configuredAllowedFlowDirections,
} from "@epanet-js/hydraulic-model";
import {
  configuredJunctionDemands,
  findReturnPath,
  findTopologyIssues,
} from "@epanet-js/network-review";
import { HydraulicModel } from "src/hydraulic-model";

const IDS = {
  R1: 1,
  J1: 2,
  J2: 3,
  J3: 4,
  T1: 5,
  PU1: 6,
  PU2: 7,
  V1: 8,
  P1: 9,
  P2: 10,
  P3: 11,
  P4: 12,
  CP1: 13,
} as const;

const topologyIssuesOf = (model: HydraulicModel) =>
  findTopologyIssues(
    new ActiveTopology(model.topology, model.assets),
    new ActiveAssetIndex(model.assetIndex, model.assets),
    configuredAllowedFlowDirections(model.assets),
    configuredJunctionDemands(model),
  );

describe("findTopologyIssues", () => {
  describe("self-feeding pumps and valves", () => {
    const aPumpedNetwork = () =>
      HydraulicModelBuilder.with()
        .aReservoir(IDS.R1)
        .aJunction(IDS.J1)
        .aJunction(IDS.J2)
        .aJunction(IDS.J3)
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .aPump(IDS.PU1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 });

    it("finds no issues without a return path", () => {
      expect(topologyIssuesOf(aPumpedNetwork().build())).toEqual({
        selfFeedingPumps: [],
        selfFeedingValves: [],
        junctionsWithoutSupply: [],
      });
    });

    it("flags a pump whose downstream node returns to its upstream node", () => {
      const model = aPumpedNetwork()
        .aPipe(IDS.P3, { startNodeId: IDS.J3, endNodeId: IDS.J1 })
        .build();

      expect(topologyIssuesOf(model).selfFeedingPumps).toEqual([IDS.PU1]);
    });

    it("flags a directional valve whose outlet returns to its inlet", () => {
      const model = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1)
        .aJunction(IDS.J1)
        .aJunction(IDS.J2)
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .aValve(IDS.V1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          kind: "prv",
        })
        .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J1 })
        .build();

      expect(topologyIssuesOf(model)).toMatchObject({
        selfFeedingPumps: [],
        selfFeedingValves: [IDS.V1],
      });
    });

    it("ignores a throttle valve with a parallel pipe", () => {
      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1)
        .aJunction(IDS.J2)
        .aValve(IDS.V1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          kind: "tcv",
        })
        .aPipe(IDS.P1, { startNodeId: IDS.J2, endNodeId: IDS.J1 })
        .build();

      expect(topologyIssuesOf(model).selfFeedingValves).toEqual([]);
    });

    it("ignores a bypass that only flows in the pump direction", () => {
      const model = aPumpedNetwork()
        .aPipe(IDS.P3, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J3,
          initialStatus: "cv",
        })
        .build();

      expect(topologyIssuesOf(model).selfFeedingPumps).toEqual([]);
    });

    it("ignores a return path through a closed pipe", () => {
      const model = aPumpedNetwork()
        .aPipe(IDS.P3, {
          startNodeId: IDS.J3,
          endNodeId: IDS.J1,
          initialStatus: "closed",
        })
        .build();

      expect(topologyIssuesOf(model).selfFeedingPumps).toEqual([]);
    });

    it("ignores a return path through an inactive pipe", () => {
      const model = aPumpedNetwork()
        .aPipe(IDS.P3, {
          startNodeId: IDS.J3,
          endNodeId: IDS.J1,
          isActive: false,
        })
        .build();

      expect(topologyIssuesOf(model).selfFeedingPumps).toEqual([]);
    });

    it("ignores a return path through a tank", () => {
      const model = aPumpedNetwork()
        .aTank(IDS.T1)
        .aPipe(IDS.P3, { startNodeId: IDS.J3, endNodeId: IDS.T1 })
        .aPipe(IDS.P4, { startNodeId: IDS.T1, endNodeId: IDS.J1 })
        .build();

      expect(topologyIssuesOf(model).selfFeedingPumps).toEqual([]);
    });

    it("ignores a pump that is off", () => {
      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1)
        .aJunction(IDS.J2)
        .aPump(IDS.PU1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          initialStatus: "off",
        })
        .aPipe(IDS.P1, { startNodeId: IDS.J2, endNodeId: IDS.J1 })
        .build();

      expect(topologyIssuesOf(model).selfFeedingPumps).toEqual([]);
    });

    it("ignores pumps in parallel", () => {
      const model = aPumpedNetwork()
        .aPump(IDS.PU2, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build();

      expect(topologyIssuesOf(model).selfFeedingPumps).toEqual([]);
    });

    it("flags every pump and valve on the same loop", () => {
      const model = aPumpedNetwork()
        .aValve(IDS.V1, {
          startNodeId: IDS.J3,
          endNodeId: IDS.J1,
          kind: "fcv",
        })
        .build();

      expect(topologyIssuesOf(model)).toMatchObject({
        selfFeedingPumps: [IDS.PU1],
        selfFeedingValves: [IDS.V1],
      });
    });
  });

  describe("junctions without supply", () => {
    const aNetworkPumpingTowardsItsSource = () =>
      HydraulicModelBuilder.with()
        .aReservoir(IDS.R1)
        .aJunction(IDS.J1)
        .aJunction(IDS.J2)
        .aJunction(IDS.J3)
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .aPump(IDS.PU1, { startNodeId: IDS.J2, endNodeId: IDS.J1 })
        .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 });

    it("flags demand junctions no source can feed", () => {
      const model = aNetworkPumpingTowardsItsSource()
        .aJunctionDemand(IDS.J1, [{ baseDemand: 1 }])
        .aJunctionDemand(IDS.J2, [{ baseDemand: 1 }])
        .aJunctionDemand(IDS.J3, [{ baseDemand: 1 }])
        .build();

      expect(topologyIssuesOf(model).junctionsWithoutSupply).toEqual([
        IDS.J2,
        IDS.J3,
      ]);
    });

    it("ignores unfed junctions without positive demand", () => {
      const model = aNetworkPumpingTowardsItsSource()
        .aJunctionDemand(IDS.J3, [{ baseDemand: 0 }])
        .build();

      expect(topologyIssuesOf(model).junctionsWithoutSupply).toEqual([]);
    });

    it("counts the demand of allocated customer points", () => {
      const model = aNetworkPumpingTowardsItsSource()
        .aCustomerPoint(IDS.CP1, {
          connection: { pipeId: IDS.P2, junctionId: IDS.J3 },
        })
        .aCustomerPointDemand(IDS.CP1, [{ baseDemand: 1 }])
        .build();

      expect(topologyIssuesOf(model).junctionsWithoutSupply).toEqual([IDS.J3]);
    });

    it("flags demand junctions behind a closed pipe", () => {
      const model = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1)
        .aJunction(IDS.J1)
        .aJunction(IDS.J2)
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .aPipe(IDS.P2, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          initialStatus: "closed",
        })
        .aJunctionDemand(IDS.J2, [{ baseDemand: 1 }])
        .build();

      expect(topologyIssuesOf(model).junctionsWithoutSupply).toEqual([IDS.J2]);
    });

    it("leaves sub-networks without any source to the connectivity trace", () => {
      const model = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1)
        .aJunction(IDS.J1)
        .aJunction(IDS.J2)
        .aJunction(IDS.J3)
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
        .aJunctionDemand(IDS.J2, [{ baseDemand: 1 }])
        .build();

      expect(topologyIssuesOf(model).junctionsWithoutSupply).toEqual([]);
    });
  });
});

describe("findReturnPath", () => {
  const returnPathOf = (model: HydraulicModel, linkId: number) =>
    findReturnPath(
      linkId,
      new ActiveTopology(model.topology, model.assets),
      new ActiveAssetIndex(model.assetIndex, model.assets),
      configuredAllowedFlowDirections(model.assets),
    );

  const aPumpBetweenJunctions = () =>
    HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPump(IDS.PU1, { startNodeId: IDS.J1, endNodeId: IDS.J2 });

  it("returns the path from the downstream node back upstream", () => {
    const model = aPumpBetweenJunctions()
      .aPipe(IDS.P1, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
      .aPipe(IDS.P2, { startNodeId: IDS.J3, endNodeId: IDS.J1 })
      .build();

    expect(returnPathOf(model, IDS.PU1)).toEqual({
      nodeIds: [IDS.J2, IDS.J3, IDS.J1],
      linkIds: [IDS.P1, IDS.P2],
    });
  });

  it("prefers the path with fewer links", () => {
    const model = aPumpBetweenJunctions()
      .aPipe(IDS.P1, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
      .aPipe(IDS.P2, { startNodeId: IDS.J3, endNodeId: IDS.J1 })
      .aPipe(IDS.P3, { startNodeId: IDS.J2, endNodeId: IDS.J1 })
      .build();

    expect(returnPathOf(model, IDS.PU1)).toEqual({
      nodeIds: [IDS.J2, IDS.J1],
      linkIds: [IDS.P3],
    });
  });

  it("does not return through a link flowing the other way", () => {
    const model = aPumpBetweenJunctions()
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        initialStatus: "cv",
      })
      .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
      .aPipe(IDS.P3, { startNodeId: IDS.J3, endNodeId: IDS.J1 })
      .build();

    expect(returnPathOf(model, IDS.PU1)).toEqual({
      nodeIds: [IDS.J2, IDS.J3, IDS.J1],
      linkIds: [IDS.P2, IDS.P3],
    });
  });

  it("returns null without a return path", () => {
    const model = aPumpBetweenJunctions()
      .aPipe(IDS.P1, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
      .build();

    expect(returnPathOf(model, IDS.PU1)).toBeNull();
  });
});
