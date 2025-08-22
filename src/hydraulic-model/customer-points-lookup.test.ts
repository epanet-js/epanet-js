import { expect, describe, it } from "vitest";
import { CustomerPointsLookup } from "./customer-points-lookup";
import { CustomerPoint } from "./customer-points";

describe("CustomerPointsLookup", () => {
  it("provides customer points connected to an asset", () => {
    const lookup = new CustomerPointsLookup();

    const cp1 = new CustomerPoint("cp1", [0, 0], { baseDemand: 10 });
    cp1.connect({ pipeId: "pipe1", snapPoint: [1, 1], junctionId: "j1" });

    const cp2 = new CustomerPoint("cp2", [0, 0], { baseDemand: 20 });
    cp2.connect({ pipeId: "pipe1", snapPoint: [2, 2], junctionId: "j2" });

    lookup.addConnection(cp1);
    lookup.addConnection(cp2);

    expect(lookup.getCustomerPoints("pipe1")).toEqual(new Set([cp1, cp2]));
    expect(lookup.getCustomerPoints("j1")).toEqual(new Set([cp1]));
    expect(lookup.getCustomerPoints("j2")).toEqual(new Set([cp2]));
  });

  it("removes customer points when removing connections", () => {
    const lookup = new CustomerPointsLookup();

    const cp1 = new CustomerPoint("cp1", [0, 0], { baseDemand: 10 });
    cp1.connect({ pipeId: "pipe1", snapPoint: [1, 1], junctionId: "j1" });

    const cp2 = new CustomerPoint("cp2", [0, 0], { baseDemand: 20 });
    cp2.connect({ pipeId: "pipe1", snapPoint: [2, 2], junctionId: "j1" });

    lookup.addConnection(cp1);
    lookup.addConnection(cp2);

    lookup.removeConnection(cp1);

    expect(lookup.getCustomerPoints("pipe1")).toEqual(new Set([cp2]));
    expect(lookup.getCustomerPoints("j1")).toEqual(new Set([cp2]));
  });

  it("does not crash when removing missing customer point", () => {
    const lookup = new CustomerPointsLookup();

    const cp1 = new CustomerPoint("cp1", [0, 0], { baseDemand: 10 });
    cp1.connect({ pipeId: "pipe1", snapPoint: [1, 1], junctionId: "j1" });

    const cp2 = new CustomerPoint("cp2", [0, 0], { baseDemand: 20 });
    cp2.connect({ pipeId: "pipe2", snapPoint: [2, 2], junctionId: "j2" });

    lookup.addConnection(cp1);

    lookup.removeConnection(cp2);

    expect(lookup.getCustomerPoints("pipe1")).toEqual(new Set([cp1]));
  });

  it("allows multiple customer points on same pipe and junction", () => {
    const lookup = new CustomerPointsLookup();

    const cp1 = new CustomerPoint("cp1", [0, 0], { baseDemand: 10 });
    cp1.connect({ pipeId: "pipe1", snapPoint: [1, 1], junctionId: "j1" });

    const cp2 = new CustomerPoint("cp2", [0, 0], { baseDemand: 20 });
    cp2.connect({ pipeId: "pipe1", snapPoint: [2, 2], junctionId: "j1" });

    lookup.addConnection(cp1);
    lookup.addConnection(cp2);

    expect(lookup.getCustomerPoints("pipe1")).toEqual(new Set([cp1, cp2]));
    expect(lookup.getCustomerPoints("j1")).toEqual(new Set([cp1, cp2]));
  });

  it("handles customer points with no connections", () => {
    const lookup = new CustomerPointsLookup();

    const cp1 = new CustomerPoint("cp1", [0, 0], { baseDemand: 10 });

    lookup.addConnection(cp1);

    expect(lookup.getCustomerPoints("pipe1")).toBeUndefined();
    expect(lookup.hasConnections("pipe1")).toBe(false);
  });

  it("handles customer points with only pipe connection", () => {
    const lookup = new CustomerPointsLookup();

    const cp1 = new CustomerPoint("cp1", [0, 0], { baseDemand: 10 });
    cp1.connect({ pipeId: "pipe1", snapPoint: [1, 1] });

    lookup.addConnection(cp1);

    expect(lookup.getCustomerPoints("pipe1")).toEqual(new Set([cp1]));
    expect(lookup.hasConnections("pipe1")).toBe(true);
    expect(lookup.hasConnections("j1")).toBe(false);
  });

  it("cleans up empty sets when removing last customer point", () => {
    const lookup = new CustomerPointsLookup();

    const cp1 = new CustomerPoint("cp1", [0, 0], { baseDemand: 10 });
    cp1.connect({ pipeId: "pipe1", snapPoint: [1, 1], junctionId: "j1" });

    lookup.addConnection(cp1);
    expect(lookup.hasConnections("pipe1")).toBe(true);
    expect(lookup.hasConnections("j1")).toBe(true);

    lookup.removeConnection(cp1);
    expect(lookup.hasConnections("pipe1")).toBe(false);
    expect(lookup.hasConnections("j1")).toBe(false);
  });

  it("can clear all connections", () => {
    const lookup = new CustomerPointsLookup();

    const cp1 = new CustomerPoint("cp1", [0, 0], { baseDemand: 10 });
    cp1.connect({ pipeId: "pipe1", snapPoint: [1, 1], junctionId: "j1" });

    lookup.addConnection(cp1);
    expect(lookup.hasConnections("pipe1")).toBe(true);

    lookup.clear();
    expect(lookup.hasConnections("pipe1")).toBe(false);
    expect(lookup.getCustomerPoints("pipe1")).toBeUndefined();
  });
});
