import { describe, it, expect } from "vitest";
import { disconnectCustomers } from "./disconnect-customers";
import {
  HydraulicModelBuilder,
  buildCustomerPoint,
} from "src/__helpers__/hydraulic-model-builder";

describe("disconnectCustomers", () => {
  it("disconnects a single connected customer point", () => {
    const connectedCP = buildCustomerPoint("CP1", {
      coordinates: [2, 1],
      demand: 25,
    });
    connectedCP.connect({
      pipeId: "P1",
      snapPoint: [2, 0],
      distance: 1,
      junctionId: "J1",
    });

    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J1",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    hydraulicModel.customerPoints.set("CP1", connectedCP);

    const { putCustomerPoints } = disconnectCustomers(hydraulicModel, {
      customerPointIds: ["CP1"],
    });

    expect(putCustomerPoints).toBeDefined();
    expect(putCustomerPoints!.length).toBe(1);

    const disconnectedCP = putCustomerPoints![0];
    expect(disconnectedCP.id).toBe("CP1");
    expect(disconnectedCP.baseDemand).toBe(25);
    expect(disconnectedCP.coordinates).toEqual([2, 1]);
    expect(disconnectedCP.connection).toBeNull();

    expect(connectedCP.connection).not.toBeNull();
  });

  it("disconnects multiple connected customer points", () => {
    const cp1 = buildCustomerPoint("CP1", {
      coordinates: [2, 1],
      demand: 25,
    });
    cp1.connect({
      pipeId: "P1",
      snapPoint: [2, 0],
      distance: 1,
      junctionId: "J1",
    });

    const cp2 = buildCustomerPoint("CP2", {
      coordinates: [8, 1],
      demand: 50,
    });
    cp2.connect({
      pipeId: "P1",
      snapPoint: [8, 0],
      distance: 1,
      junctionId: "J2",
    });

    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 0] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    hydraulicModel.customerPoints.set("CP1", cp1);
    hydraulicModel.customerPoints.set("CP2", cp2);

    const { putCustomerPoints } = disconnectCustomers(hydraulicModel, {
      customerPointIds: ["CP1", "CP2"],
    });

    expect(putCustomerPoints).toBeDefined();
    expect(putCustomerPoints!.length).toBe(2);

    const disconnectedCP1 = putCustomerPoints!.find((cp) => cp.id === "CP1")!;
    const disconnectedCP2 = putCustomerPoints!.find((cp) => cp.id === "CP2")!;

    expect(disconnectedCP1.connection).toBeNull();
    expect(disconnectedCP2.connection).toBeNull();
    expect(disconnectedCP1.baseDemand).toBe(25);
    expect(disconnectedCP2.baseDemand).toBe(50);

    expect(cp1.connection).not.toBeNull();
    expect(cp2.connection).not.toBeNull();
  });

  it("handles already disconnected customer points", () => {
    const disconnectedCP = buildCustomerPoint("CP1", {
      coordinates: [2, 1],
      demand: 25,
    });

    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .build();

    hydraulicModel.customerPoints.set("CP1", disconnectedCP);

    const { putCustomerPoints } = disconnectCustomers(hydraulicModel, {
      customerPointIds: ["CP1"],
    });

    expect(putCustomerPoints).toBeDefined();
    expect(putCustomerPoints!.length).toBe(1);

    const resultCP = putCustomerPoints![0];
    expect(resultCP.id).toBe("CP1");
    expect(resultCP.connection).toBeNull();
  });

  it("throws error for non-existent customer point", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .build();

    expect(() => {
      disconnectCustomers(hydraulicModel, {
        customerPointIds: ["NON_EXISTENT"],
      });
    }).toThrow("Customer point with id NON_EXISTENT not found");
  });

  it("ensures immutability by creating new instances", () => {
    const originalCP = buildCustomerPoint("CP1", {
      coordinates: [2, 1],
      demand: 25,
    });
    originalCP.connect({
      pipeId: "P1",
      snapPoint: [2, 0],
      distance: 1,
      junctionId: "J1",
    });

    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .build();

    hydraulicModel.customerPoints.set("CP1", originalCP);

    const { putCustomerPoints } = disconnectCustomers(hydraulicModel, {
      customerPointIds: ["CP1"],
    });

    const disconnectedCP = putCustomerPoints![0];

    expect(disconnectedCP).not.toBe(originalCP);
    expect(disconnectedCP.id).toBe(originalCP.id);
    expect(disconnectedCP.baseDemand).toBe(originalCP.baseDemand);
    expect(disconnectedCP.coordinates).toEqual(originalCP.coordinates);
    expect(disconnectedCP.connection).toBeNull();
    expect(originalCP.connection).not.toBeNull();
  });

  it("handles mixed connected and disconnected customer points", () => {
    const connectedCP = buildCustomerPoint("CP1", {
      coordinates: [2, 1],
      demand: 25,
    });
    connectedCP.connect({
      pipeId: "P1",
      snapPoint: [2, 0],
      distance: 1,
      junctionId: "J1",
    });

    const disconnectedCP = buildCustomerPoint("CP2", {
      coordinates: [8, 1],
      demand: 50,
    });

    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .build();

    hydraulicModel.customerPoints.set("CP1", connectedCP);
    hydraulicModel.customerPoints.set("CP2", disconnectedCP);

    const { putCustomerPoints } = disconnectCustomers(hydraulicModel, {
      customerPointIds: ["CP1", "CP2"],
    });

    expect(putCustomerPoints!.length).toBe(2);

    putCustomerPoints!.forEach((cp) => {
      expect(cp.connection).toBeNull();
    });
  });

  it("returns correct note", () => {
    const cp = buildCustomerPoint("CP1", { coordinates: [0, 0], demand: 10 });

    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .build();

    hydraulicModel.customerPoints.set("CP1", cp);

    const result = disconnectCustomers(hydraulicModel, {
      customerPointIds: ["CP1"],
    });

    expect(result.note).toBe("Disconnect customers");
  });
});
