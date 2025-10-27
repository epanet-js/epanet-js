import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { findSubNetworks } from "./find-subnetworks";
import { EncodedHydraulicModel, HydraulicModelEncoder } from "../shared";
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
    const model = HydraulicModelBuilder.with()
      .aReservoir("R1")
      .aNode("J1")
      .aNode("J2")
      .aPipe("P1", { startNodeId: "R1", endNodeId: "J1" })
      .aPipe("P2", { startNodeId: "J1", endNodeId: "J2" })
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
    const model = HydraulicModelBuilder.with()
      .aReservoir("R1")
      .aNode("J1")
      .aPipe("P1", { startNodeId: "R1", endNodeId: "J1" })
      .aTank("T1")
      .aNode("J2")
      .aPipe("P2", { startNodeId: "T1", endNodeId: "J2" })
      .aNode("J3")
      .aNode("J4")
      .aPipe("P3", { startNodeId: "J3", endNodeId: "J4" })
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
    const model = HydraulicModelBuilder.with()
      .aNode("J1")
      .aNode("J2")
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
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
    const model = HydraulicModelBuilder.with()
      .aNode("J1")
      .aNode("J2")
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .aReservoir("R1")
      .aNode("J3")
      .aNode("J4")
      .aNode("J5")
      .aPipe("P2", { startNodeId: "R1", endNodeId: "J3" })
      .aPipe("P3", { startNodeId: "J3", endNodeId: "J4" })
      .aPipe("P4", { startNodeId: "J4", endNodeId: "J5" })
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
    const model = HydraulicModelBuilder.with()
      .aNode("J1", [1, 2])
      .aNode("J2", [0, 3])
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
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
    const model = HydraulicModelBuilder.with()
      .aTank("T1")
      .aNode("J1")
      .aPump("PU1", { startNodeId: "T1", endNodeId: "J1" })
      .aNode("J2")
      .aValve("V1", { startNodeId: "J1", endNodeId: "J2" })
      .aNode("J3")
      .aPipe("P1", { startNodeId: "J2", endNodeId: "J3" })
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
    const model = HydraulicModelBuilder.with()
      .aNode("J1", [0, 0])
      .aNode("J2", [1, 1])
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .aNode("IsolatedNode")
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
    const model = HydraulicModelBuilder.with()
      .aTank("T1")
      .aReservoir("R1")
      .aNode("J1")
      .aPipe("P1", { startNodeId: "T1", endNodeId: "J1" })
      .aPipe("P2", { startNodeId: "R1", endNodeId: "J1" })
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
