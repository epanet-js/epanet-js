import { decodeSubNetworks } from "./data";

describe("decodeSubNetworks", () => {
  it("correctly maps node indices to asset IDs", () => {
    const nodeIdsLookup = ["J1", "J2", "J3", "R1"];
    const linkIdsLookup = ["P1", "P2"];
    const encodedSubNetworks = {
      subnetworks: [
        {
          subnetworkId: 0,
          nodeIndices: [0, 1, 2],
          linkIndices: [0, 1],
          supplySourceCount: 0,
          pipeCount: 2,
          bounds: [0, 0, 10, 10],
        },
      ],
    };

    const subnetworks = decodeSubNetworks(
      nodeIdsLookup,
      linkIdsLookup,
      encodedSubNetworks,
    );

    expect(subnetworks).toHaveLength(1);
    expect(subnetworks[0].nodeIds).toEqual(["J1", "J2", "J3"]);
  });

  it("correctly maps link indices to asset IDs", () => {
    const nodeIdsLookup = ["J1", "J2"];
    const linkIdsLookup = ["P1", "P2", "P3"];
    const encodedSubNetworks = {
      subnetworks: [
        {
          subnetworkId: 0,
          nodeIndices: [0, 1],
          linkIndices: [0, 2],
          supplySourceCount: 0,
          pipeCount: 2,
          bounds: [0, 0, 10, 10],
        },
      ],
    };

    const subnetworks = decodeSubNetworks(
      nodeIdsLookup,
      linkIdsLookup,
      encodedSubNetworks,
    );

    expect(subnetworks).toHaveLength(1);
    expect(subnetworks[0].linkIds).toEqual(["P1", "P3"]);
  });

  it("preserves subnetworkId", () => {
    const nodeIdsLookup = ["J1"];
    const linkIdsLookup = ["P1"];
    const encodedSubNetworks = {
      subnetworks: [
        {
          subnetworkId: 42,
          nodeIndices: [0],
          linkIndices: [0],
          supplySourceCount: 0,
          pipeCount: 1,
          bounds: [0, 0, 10, 10],
        },
      ],
    };

    const subnetworks = decodeSubNetworks(
      nodeIdsLookup,
      linkIdsLookup,
      encodedSubNetworks,
    );

    expect(subnetworks).toHaveLength(1);
    expect(subnetworks[0].subnetworkId).toBe(42);
  });

  it("preserves supplySourceCount", () => {
    const nodeIdsLookup = ["R1", "J1"];
    const linkIdsLookup = ["P1"];
    const encodedSubNetworks = {
      subnetworks: [
        {
          subnetworkId: 0,
          nodeIndices: [0, 1],
          linkIndices: [0],
          supplySourceCount: 3,
          pipeCount: 1,
          bounds: [0, 0, 10, 10],
        },
      ],
    };

    const subnetworks = decodeSubNetworks(
      nodeIdsLookup,
      linkIdsLookup,
      encodedSubNetworks,
    );

    expect(subnetworks).toHaveLength(1);
    expect(subnetworks[0].supplySourceCount).toBe(3);
  });

  it("preserves pipeCount", () => {
    const nodeIdsLookup = ["J1"];
    const linkIdsLookup = ["P1", "P2", "P3"];
    const encodedSubNetworks = {
      subnetworks: [
        {
          subnetworkId: 0,
          nodeIndices: [0],
          linkIndices: [0, 1, 2],
          supplySourceCount: 0,
          pipeCount: 5,
          bounds: [0, 0, 10, 10],
        },
      ],
    };

    const subnetworks = decodeSubNetworks(
      nodeIdsLookup,
      linkIdsLookup,
      encodedSubNetworks,
    );

    expect(subnetworks).toHaveLength(1);
    expect(subnetworks[0].pipeCount).toBe(5);
  });

  it("preserves bounds array", () => {
    const nodeIdsLookup = ["J1"];
    const linkIdsLookup = ["P1"];
    const encodedSubNetworks = {
      subnetworks: [
        {
          subnetworkId: 0,
          nodeIndices: [0],
          linkIndices: [0],
          supplySourceCount: 0,
          pipeCount: 1,
          bounds: [-123.456, 78.9, 100.5, 200.75],
        },
      ],
    };

    const subnetworks = decodeSubNetworks(
      nodeIdsLookup,
      linkIdsLookup,
      encodedSubNetworks,
    );

    expect(subnetworks).toHaveLength(1);
    expect(subnetworks[0].bounds).toEqual([-123.456, 78.9, 100.5, 200.75]);
  });

  it("handles multiple subnetworks correctly", () => {
    const nodeIdsLookup = ["J1", "J2", "J3", "J4", "R1", "T1"];
    const linkIdsLookup = ["P1", "P2", "P3", "P4"];
    const encodedSubNetworks = {
      subnetworks: [
        {
          subnetworkId: 0,
          nodeIndices: [0, 1, 4],
          linkIndices: [0, 1],
          supplySourceCount: 1,
          pipeCount: 2,
          bounds: [0, 0, 10, 10],
        },
        {
          subnetworkId: 1,
          nodeIndices: [2, 3, 5],
          linkIndices: [2, 3],
          supplySourceCount: 1,
          pipeCount: 2,
          bounds: [20, 20, 30, 30],
        },
      ],
    };

    const subnetworks = decodeSubNetworks(
      nodeIdsLookup,
      linkIdsLookup,
      encodedSubNetworks,
    );

    expect(subnetworks).toHaveLength(2);

    expect(subnetworks[0].subnetworkId).toBe(0);
    expect(subnetworks[0].nodeIds).toEqual(["J1", "J2", "R1"]);
    expect(subnetworks[0].linkIds).toEqual(["P1", "P2"]);
    expect(subnetworks[0].supplySourceCount).toBe(1);
    expect(subnetworks[0].pipeCount).toBe(2);
    expect(subnetworks[0].bounds).toEqual([0, 0, 10, 10]);

    expect(subnetworks[1].subnetworkId).toBe(1);
    expect(subnetworks[1].nodeIds).toEqual(["J3", "J4", "T1"]);
    expect(subnetworks[1].linkIds).toEqual(["P3", "P4"]);
    expect(subnetworks[1].supplySourceCount).toBe(1);
    expect(subnetworks[1].pipeCount).toBe(2);
    expect(subnetworks[1].bounds).toEqual([20, 20, 30, 30]);
  });

  it("handles empty subnetworks array", () => {
    const nodeIdsLookup = ["J1"];
    const linkIdsLookup = ["P1"];
    const encodedSubNetworks = {
      subnetworks: [],
    };

    const subnetworks = decodeSubNetworks(
      nodeIdsLookup,
      linkIdsLookup,
      encodedSubNetworks,
    );

    expect(subnetworks).toHaveLength(0);
  });
});
