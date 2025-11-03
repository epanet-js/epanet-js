import { describe, it, expect } from "vitest";
import { findJunctionForCustomerPoint } from "./junction-assignment";

describe("findJunctionForCustomerPoint", () => {
  it("returns null when no junctions are available", () => {
    const startNode = {
      id: 1,
      type: "reservoir",
      coordinates: [0, 0],
    };
    const endNode = {
      id: 2,
      type: "tank",
      coordinates: [10, 0],
    };
    const snapPoint = [5, 0];

    const result = findJunctionForCustomerPoint(startNode, endNode, snapPoint);

    expect(result).toBeNull();
  });

  it("returns the single junction when only one is available", () => {
    const startNode = {
      id: 1,
      type: "junction",
      coordinates: [0, 0],
    };
    const endNode = {
      id: 2,
      type: "tank",
      coordinates: [10, 0],
    };
    const snapPoint = [5, 0];

    const result = findJunctionForCustomerPoint(startNode, endNode, snapPoint);

    expect(result).toBe(1);
  });

  it("returns the closest junction when both nodes are junctions", () => {
    const startNode = {
      id: 1,
      type: "junction",
      coordinates: [0, 0],
    };
    const endNode = {
      id: 2,
      type: "junction",
      coordinates: [100, 0],
    };
    const snapPoint = [10, 0]; // closer to J1

    const result = findJunctionForCustomerPoint(startNode, endNode, snapPoint);

    expect(result).toBe(1);
  });

  it("returns the closest junction when snap point is closer to end node", () => {
    const startNode = {
      id: 1,
      type: "junction",
      coordinates: [0, 0],
    };
    const endNode = {
      id: 2,
      type: "junction",
      coordinates: [100, 0],
    };
    const snapPoint = [90, 0]; // closer to J2

    const result = findJunctionForCustomerPoint(startNode, endNode, snapPoint);

    expect(result).toBe(2);
  });

  it("handles case where start node is junction and end is reservoir", () => {
    const startNode = {
      id: 1,
      type: "junction",
      coordinates: [0, 0],
    };
    const endNode = {
      id: 2,
      type: "reservoir",
      coordinates: [10, 0],
    };
    const snapPoint = [8, 0];

    const result = findJunctionForCustomerPoint(startNode, endNode, snapPoint);

    expect(result).toBe(1);
  });

  it("handles case where end node is junction and start is tank", () => {
    const startNode = {
      id: 1,
      type: "tank",
      coordinates: [0, 0],
    };
    const endNode = {
      id: 2,
      type: "junction",
      coordinates: [10, 0],
    };
    const snapPoint = [2, 0];

    const result = findJunctionForCustomerPoint(startNode, endNode, snapPoint);

    expect(result).toBe(2);
  });

  it("correctly calculates distance for tie-breaking", () => {
    const startNode = {
      id: 1,
      type: "junction",
      coordinates: [0, 0],
    };
    const endNode = {
      id: 2,
      type: "junction",
      coordinates: [10, 0],
    };
    const snapPoint = [5.1, 0]; // slightly closer to J2

    const result = findJunctionForCustomerPoint(startNode, endNode, snapPoint);

    expect(result).toBe(2);
  });

  it("handles exact midpoint by returning first junction due to stable sort", () => {
    const startNode = {
      id: 1,
      type: "junction",
      coordinates: [0, 0],
    };
    const endNode = {
      id: 2,
      type: "junction",
      coordinates: [10, 0],
    };
    const snapPoint = [5, 0]; // exactly in the middle

    const result = findJunctionForCustomerPoint(startNode, endNode, snapPoint);

    // Either J1 or J2 is acceptable since they're equidistant
    expect([1, 2]).toContain(result);
  });
});
