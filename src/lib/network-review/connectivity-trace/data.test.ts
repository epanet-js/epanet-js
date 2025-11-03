import { decodeSubNetworks, EncodedSubNetwork } from "./data";

const IDS = {
  J1: 1,
  J2: 2,
  J3: 3,
  J4: 4,
  R1: 5,
  T1: 6,
  P1: 7,
  P2: 8,
  P3: 9,
  P4: 10,
} as const;

describe("decodeSubNetworks", () => {
  it("correctly maps node indices to asset IDs", () => {
    const nodeIdsLookup = [IDS.J1, IDS.J2, IDS.J3, IDS.R1];
    const linkIdsLookup = [IDS.P1, IDS.P2];
    const encodedSubNetworks: EncodedSubNetwork[] = [
      {
        subnetworkId: 0,
        nodeIndices: [0, 1, 2],
        linkIndices: [0, 1],
        supplySourceCount: 0,
        pipeCount: 2,
        bounds: [0, 0, 10, 10] as [number, number, number, number],
      },
    ];

    const subnetworks = decodeSubNetworks(
      nodeIdsLookup,
      linkIdsLookup,
      encodedSubNetworks,
    );

    expect(subnetworks).toHaveLength(1);
    expect(subnetworks[0].nodeIds).toEqual([IDS.J1, IDS.J2, IDS.J3]);
  });

  it("correctly maps link indices to asset IDs", () => {
    const nodeIdsLookup = [IDS.J1, IDS.J2];
    const linkIdsLookup = [IDS.P1, IDS.P2, IDS.P3];
    const encodedSubNetworks: EncodedSubNetwork[] = [
      {
        subnetworkId: 0,
        nodeIndices: [0, 1],
        linkIndices: [0, 2],
        supplySourceCount: 0,
        pipeCount: 2,
        bounds: [0, 0, 10, 10] as [number, number, number, number],
      },
    ];

    const subnetworks = decodeSubNetworks(
      nodeIdsLookup,
      linkIdsLookup,
      encodedSubNetworks,
    );

    expect(subnetworks).toHaveLength(1);
    expect(subnetworks[0].linkIds).toEqual([IDS.P1, IDS.P3]);
  });

  it("preserves subnetworkId", () => {
    const nodeIdsLookup = [IDS.J1];
    const linkIdsLookup = [IDS.P1];
    const encodedSubNetworks: EncodedSubNetwork[] = [
      {
        subnetworkId: 42,
        nodeIndices: [0],
        linkIndices: [0],
        supplySourceCount: 0,
        pipeCount: 1,
        bounds: [0, 0, 10, 10] as [number, number, number, number],
      },
    ];

    const subnetworks = decodeSubNetworks(
      nodeIdsLookup,
      linkIdsLookup,
      encodedSubNetworks,
    );

    expect(subnetworks).toHaveLength(1);
    expect(subnetworks[0].subnetworkId).toBe(42);
  });

  it("preserves supplySourceCount", () => {
    const nodeIdsLookup = [IDS.R1, IDS.J1];
    const linkIdsLookup = [IDS.P1];
    const encodedSubNetworks: EncodedSubNetwork[] = [
      {
        subnetworkId: 0,
        nodeIndices: [0, 1],
        linkIndices: [0],
        supplySourceCount: 3,
        pipeCount: 1,
        bounds: [0, 0, 10, 10] as [number, number, number, number],
      },
    ];

    const subnetworks = decodeSubNetworks(
      nodeIdsLookup,
      linkIdsLookup,
      encodedSubNetworks,
    );

    expect(subnetworks).toHaveLength(1);
    expect(subnetworks[0].supplySourceCount).toBe(3);
  });

  it("preserves pipeCount", () => {
    const nodeIdsLookup = [IDS.J1];
    const linkIdsLookup = [IDS.P1, IDS.P2, IDS.P3];
    const encodedSubNetworks: EncodedSubNetwork[] = [
      {
        subnetworkId: 0,
        nodeIndices: [0],
        linkIndices: [0, 1, 2],
        supplySourceCount: 0,
        pipeCount: 5,
        bounds: [0, 0, 10, 10] as [number, number, number, number],
      },
    ];

    const subnetworks = decodeSubNetworks(
      nodeIdsLookup,
      linkIdsLookup,
      encodedSubNetworks,
    );

    expect(subnetworks).toHaveLength(1);
    expect(subnetworks[0].pipeCount).toBe(5);
  });

  it("preserves bounds array", () => {
    const nodeIdsLookup = [IDS.J1];
    const linkIdsLookup = [IDS.P1];
    const encodedSubNetworks: EncodedSubNetwork[] = [
      {
        subnetworkId: 0,
        nodeIndices: [0],
        linkIndices: [0],
        supplySourceCount: 0,
        pipeCount: 1,
        bounds: [-123.456, 78.9, 100.5, 200.75] as [
          number,
          number,
          number,
          number,
        ],
      },
    ];

    const subnetworks = decodeSubNetworks(
      nodeIdsLookup,
      linkIdsLookup,
      encodedSubNetworks,
    );

    expect(subnetworks).toHaveLength(1);
    expect(subnetworks[0].bounds).toEqual([-123.456, 78.9, 100.5, 200.75]);
  });

  it("handles multiple subnetworks correctly", () => {
    const nodeIdsLookup = [IDS.J1, IDS.J2, IDS.J3, IDS.J4, IDS.R1, IDS.T1];
    const linkIdsLookup = [IDS.P1, IDS.P2, IDS.P3, IDS.P4];
    const encodedSubNetworks: EncodedSubNetwork[] = [
      {
        subnetworkId: 0,
        nodeIndices: [0, 1, 4],
        linkIndices: [0, 1],
        supplySourceCount: 1,
        pipeCount: 2,
        bounds: [0, 0, 10, 10] as [number, number, number, number],
      },
      {
        subnetworkId: 1,
        nodeIndices: [2, 3, 5],
        linkIndices: [2, 3],
        supplySourceCount: 1,
        pipeCount: 2,
        bounds: [20, 20, 30, 30] as [number, number, number, number],
      },
    ];

    const subnetworks = decodeSubNetworks(
      nodeIdsLookup,
      linkIdsLookup,
      encodedSubNetworks,
    );

    expect(subnetworks).toHaveLength(2);

    expect(subnetworks[0].subnetworkId).toBe(0);
    expect(subnetworks[0].nodeIds).toEqual([IDS.J1, IDS.J2, IDS.R1]);
    expect(subnetworks[0].linkIds).toEqual([IDS.P1, IDS.P2]);
    expect(subnetworks[0].supplySourceCount).toBe(1);
    expect(subnetworks[0].pipeCount).toBe(2);
    expect(subnetworks[0].bounds).toEqual([0, 0, 10, 10]);

    expect(subnetworks[1].subnetworkId).toBe(1);
    expect(subnetworks[1].nodeIds).toEqual([IDS.J3, IDS.J4, IDS.T1]);
    expect(subnetworks[1].linkIds).toEqual([IDS.P3, IDS.P4]);
    expect(subnetworks[1].supplySourceCount).toBe(1);
    expect(subnetworks[1].pipeCount).toBe(2);
    expect(subnetworks[1].bounds).toEqual([20, 20, 30, 30]);
  });

  it("handles empty subnetworks array", () => {
    const nodeIdsLookup = [IDS.J1];
    const linkIdsLookup = [IDS.P1];
    const encodedSubNetworks: EncodedSubNetwork[] = [];

    const subnetworks = decodeSubNetworks(
      nodeIdsLookup,
      linkIdsLookup,
      encodedSubNetworks,
    );

    expect(subnetworks).toHaveLength(0);
  });
});
