import { describe, it, expect } from "vitest";
import { disconnectCustomers } from "./disconnect-customers";
import {
  HydraulicModelBuilder,
  buildCustomerPoint,
} from "src/__helpers__/hydraulic-model-builder";

describe("disconnectCustomers", () => {
  it("disconnects a single connected customer point", () => {
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
      .aCustomerPoint("CP1", {
        demand: 25,
        coordinates: [2, 1],
        connection: { pipeId: "P1", junctionId: "J1" },
      })
      .build();

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
  });

  it("disconnects multiple connected customer points", () => {
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
      .aCustomerPoint("CP1", {
        demand: 25,
        coordinates: [2, 1],
        connection: { pipeId: "P1", junctionId: "J1" },
      })
      .aCustomerPoint("CP2", {
        demand: 50,
        coordinates: [8, 1],
        connection: { pipeId: "P1", junctionId: "J2" },
      })
      .build();

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

  it("handles customer points with no junction connection", () => {
    const cp = buildCustomerPoint("CP1", {
      coordinates: [2, 1],
      demand: 25,
    });
    cp.connect({
      pipeId: "P1",
      snapPoint: [2, 0],
      junctionId: "J1",
    });

    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .build();

    hydraulicModel.customerPoints.set("CP1", cp);

    const { putAssets, putCustomerPoints } = disconnectCustomers(
      hydraulicModel,
      {
        customerPointIds: ["CP1"],
      },
    );

    expect(putCustomerPoints).toBeDefined();
    expect(putCustomerPoints!.length).toBe(1);
    expect(putAssets).toBeUndefined();
    expect(putCustomerPoints![0].connection).toBeNull();
  });
});
