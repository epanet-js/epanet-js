import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { findSubNetworks } from "./find-subnetworks";
import {
  EncodedHydraulicModel,
  HydraulicModelEncoder,
} from "../hydraulic-model-buffers";
import { decodeSubNetworks } from "./data";
import { HydraulicModel } from "src/hydraulic-model";

describe("findSubNetworks", () => {
  function encodeData(model: HydraulicModel): EncodedHydraulicModel {
    const encoder = new HydraulicModelEncoder(model, {
      nodes: new Set(["types", "connections"]),
      links: new Set(["types", "connections", "bounds"]),
      bufferType: "array",
    });
    return encoder.buildBuffers();
  }

  it("should identify a single connected network", () => {
    const IDS = { R1: 1, J1: 2, J2: 3, P1: 4, P2: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1)
      .aNode(IDS.J1)
      .aNode(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .aPipe(IDS.P2, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();
    const { linkIdsLookup, nodeIdsLookup, ...data } = encodeData(model);

    const encodedSubNetworks = findSubNetworks(data);
    const subnetworks = decodeSubNetworks(
      nodeIdsLookup,
      linkIdsLookup,
      encodedSubNetworks,
    );

    expect(subnetworks).toHaveLength(1);
    expect(subnetworks[0].nodeIds).toHaveLength(3);
    expect(subnetworks[0].linkIds).toHaveLength(2);
    expect(subnetworks[0].supplySourceCount).toBe(1);
  });

  it("should identify multiple disconnected sub-networks", () => {
    const IDS = {
      R1: 1,
      J1: 2,
      P1: 3,
      T1: 4,
      J2: 5,
      P2: 6,
      J3: 7,
      J4: 8,
      P3: 9,
    } as const;
    const model = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1)
      .aNode(IDS.J1)
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .aTank(IDS.T1)
      .aNode(IDS.J2)
      .aPipe(IDS.P2, { startNodeId: IDS.T1, endNodeId: IDS.J2 })
      .aNode(IDS.J3)
      .aNode(IDS.J4)
      .aPipe(IDS.P3, { startNodeId: IDS.J3, endNodeId: IDS.J4 })
      .build();
    const { nodeIdsLookup, linkIdsLookup, ...data } = encodeData(model);

    const encodedSubNetworks = findSubNetworks(data);
    const subnetworks = decodeSubNetworks(
      nodeIdsLookup,
      linkIdsLookup,
      encodedSubNetworks,
    );

    expect(subnetworks).toHaveLength(3);

    const networksWithSupply = subnetworks.filter(
      (s) => s.supplySourceCount > 0,
    );
    const networksWithoutSupply = subnetworks.filter(
      (s) => s.supplySourceCount === 0,
    );

    expect(networksWithSupply).toHaveLength(2);
    expect(networksWithoutSupply).toHaveLength(1);
  });

  it("should detect sub-networks without supply sources", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const model = HydraulicModelBuilder.with()
      .aNode(IDS.J1)
      .aNode(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();
    const { nodeIdsLookup, linkIdsLookup, ...data } = encodeData(model);

    const encodedSubNetworks = findSubNetworks(data);
    const subnetworks = decodeSubNetworks(
      nodeIdsLookup,
      linkIdsLookup,
      encodedSubNetworks,
    );

    expect(subnetworks).toHaveLength(1);
    expect(subnetworks[0].supplySourceCount).toBe(0);
  });

  it("should sort sub-networks by size (largest first)", () => {
    const IDS = {
      J1: 1,
      J2: 2,
      P1: 3,
      R1: 4,
      J3: 5,
      J4: 6,
      J5: 7,
      P2: 8,
      P3: 9,
      P4: 10,
    } as const;
    const model = HydraulicModelBuilder.with()
      .aNode(IDS.J1)
      .aNode(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aReservoir(IDS.R1)
      .aNode(IDS.J3)
      .aNode(IDS.J4)
      .aNode(IDS.J5)
      .aPipe(IDS.P2, { startNodeId: IDS.R1, endNodeId: IDS.J3 })
      .aPipe(IDS.P3, { startNodeId: IDS.J3, endNodeId: IDS.J4 })
      .aPipe(IDS.P4, { startNodeId: IDS.J4, endNodeId: IDS.J5 })
      .build();
    const { nodeIdsLookup, linkIdsLookup, ...data } = encodeData(model);

    const encodedSubNetworks = findSubNetworks(data);
    const subnetworks = decodeSubNetworks(
      nodeIdsLookup,
      linkIdsLookup,
      encodedSubNetworks,
    );

    expect(subnetworks).toHaveLength(2);
    expect(subnetworks[0].nodeIds.length).toBeGreaterThan(
      subnetworks[1].nodeIds.length,
    );
  });

  it("should calculate bounds for each sub-network", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const model = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [1, 2])
      .aNode(IDS.J2, [0, 3])
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();
    const { nodeIdsLookup, linkIdsLookup, ...data } = encodeData(model);

    const encodedSubNetworks = findSubNetworks(data);
    const subnetworks = decodeSubNetworks(
      nodeIdsLookup,
      linkIdsLookup,
      encodedSubNetworks,
    );

    expect(subnetworks).toHaveLength(1);
    expect(subnetworks[0].bounds).toEqual([0, 2, 1, 3]);
  });

  it("should handle networks with pumps and valves", () => {
    const IDS = { T1: 1, J1: 2, PU1: 3, J2: 4, V1: 5, J3: 6, P1: 7 } as const;
    const model = HydraulicModelBuilder.with()
      .aTank(IDS.T1)
      .aNode(IDS.J1)
      .aPump(IDS.PU1, {
        startNodeId: IDS.T1,
        endNodeId: IDS.J1,
      })
      .aNode(IDS.J2)
      .aValve(IDS.V1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
      })
      .aNode(IDS.J3)
      .aPipe(IDS.P1, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
      .build();
    const { nodeIdsLookup, linkIdsLookup, ...data } = encodeData(model);

    const encodedSubNetworks = findSubNetworks(data);
    const subnetworks = decodeSubNetworks(
      nodeIdsLookup,
      linkIdsLookup,
      encodedSubNetworks,
    );

    expect(subnetworks).toHaveLength(1);
    expect(subnetworks[0].nodeIds).toHaveLength(4);
    expect(subnetworks[0].linkIds).toHaveLength(3);
    expect(subnetworks[0].supplySourceCount).toBe(1);
  });

  it("does not report isolated single nodes", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, IsolatedNode: 4 } as const;
    const model = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [1, 1])
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aNode(IDS.IsolatedNode)
      .build();
    const { nodeIdsLookup, linkIdsLookup, ...data } = encodeData(model);

    const encodedSubNetworks = findSubNetworks(data);
    const subnetworks = decodeSubNetworks(
      nodeIdsLookup,
      linkIdsLookup,
      encodedSubNetworks,
    );

    expect(subnetworks).toHaveLength(1);
  });

  it("should detect both tank and reservoir as supply sources", () => {
    const IDS = { T1: 1, R1: 2, J1: 3, P1: 4, P2: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aTank(IDS.T1)
      .aReservoir(IDS.R1)
      .aNode(IDS.J1)
      .aPipe(IDS.P1, { startNodeId: IDS.T1, endNodeId: IDS.J1 })
      .aPipe(IDS.P2, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .build();
    const { nodeIdsLookup, linkIdsLookup, ...data } = encodeData(model);

    const encodedSubNetworks = findSubNetworks(data);
    const subnetworks = decodeSubNetworks(
      nodeIdsLookup,
      linkIdsLookup,
      encodedSubNetworks,
    );

    expect(subnetworks).toHaveLength(1);
    expect(subnetworks[0].supplySourceCount).toBe(2);
  });
});
