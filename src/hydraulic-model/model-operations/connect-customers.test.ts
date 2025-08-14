import { describe, it, expect } from "vitest";
import { connectCustomers } from "./connect-customers";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";

describe("connectCustomers", () => {
  it("connects a single customer point to closest junction", () => {
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
        coordinates: [2, 1],
      })
      .build();

    const { putCustomerPoints, putAssets } = connectCustomers(hydraulicModel, {
      customerPointIds: ["CP1"],
      pipeId: "P1",
      snapPoints: [[2, 0]], // closer to J1
    });

    expect(putCustomerPoints).toBeDefined();
    expect(putCustomerPoints!.length).toBe(1);

    const connectedCP = putCustomerPoints![0];
    expect(connectedCP.id).toBe("CP1");
    expect(connectedCP.coordinates).toEqual([2, 1]);
    expect(connectedCP.connection).not.toBeNull();
    expect(connectedCP.connection!.pipeId).toBe("P1");
    expect(connectedCP.connection!.junctionId).toBe("J1");
    expect(connectedCP.connection!.snapPoint).toEqual([2, 0]);

    expect(putAssets).toBeDefined();
    expect(putAssets!.length).toBe(1);
    const updatedJunction = putAssets![0];
    expect(updatedJunction.id).toBe("J1");
  });

  it("connects multiple customer points to same pipe", () => {
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
        coordinates: [2, 1],
      })
      .aCustomerPoint("CP2", {
        coordinates: [8, 1],
      })
      .build();

    const result = connectCustomers(hydraulicModel, {
      customerPointIds: ["CP1", "CP2"],
      pipeId: "P1",
      snapPoints: [
        [2, 0],
        [8, 0],
      ], // CP1 closer to J1, CP2 closer to J2
    });

    const { putCustomerPoints, putAssets } = result;

    expect(putCustomerPoints).toBeDefined();
    expect(putCustomerPoints!.length).toBe(2);

    const connectedCP1 = putCustomerPoints!.find((cp) => cp.id === "CP1")!;
    const connectedCP2 = putCustomerPoints!.find((cp) => cp.id === "CP2")!;

    expect(connectedCP1.connection!.junctionId).toBe("J1");
    expect(connectedCP2.connection!.junctionId).toBe("J2");

    expect(putAssets).toBeDefined();
    expect(putAssets!.length).toBe(2); // Both junctions modified
    expect(result.note).toBe("Connect customers");
  });

  it("moves customer point from existing connection", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 0] })
      .aJunction("J3", { coordinates: [5, 10] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .aPipe("P2", {
        startNodeId: "J1",
        endNodeId: "J3",
        coordinates: [
          [0, 0],
          [5, 10],
        ],
      })
      .aCustomerPoint("CP1", {
        demand: 25,
        coordinates: [2, 5],
        connection: { pipeId: "P2", junctionId: "J1" },
      })
      .build();

    const { putCustomerPoints, putAssets } = connectCustomers(hydraulicModel, {
      customerPointIds: ["CP1"],
      pipeId: "P1",
      snapPoints: [[8, 0]], // closer to J2 on P1
    });

    expect(putCustomerPoints).toBeDefined();
    expect(putCustomerPoints!.length).toBe(1);

    const connectedCP = putCustomerPoints![0];
    expect(connectedCP.connection!.pipeId).toBe("P1");
    expect(connectedCP.connection!.junctionId).toBe("J2");

    expect(putAssets).toBeDefined();
    expect(putAssets!.length).toBe(2); // J1 (removed) and J2 (added)

    const oldJunction = putAssets!.find((a) => a.id === "J1");
    const newJunction = putAssets!.find((a) => a.id === "J2");
    expect(oldJunction).toBeDefined();
    expect(newJunction).toBeDefined();
  });

  it("throws error for non-existent customer point", () => {
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

    expect(() => {
      connectCustomers(hydraulicModel, {
        customerPointIds: ["NON_EXISTENT"],
        pipeId: "P1",
        snapPoints: [[5, 0]],
      });
    }).toThrow("Customer point with id NON_EXISTENT not found");
  });

  it("throws error for non-existent pipe", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aCustomerPoint("CP1", {
        coordinates: [2, 1],
      })
      .build();

    expect(() => {
      connectCustomers(hydraulicModel, {
        customerPointIds: ["CP1"],
        pipeId: "NON_EXISTENT",
        snapPoints: [[5, 0]],
      });
    }).toThrow("Pipe with id NON_EXISTENT not found");
  });

  it("throws error when customer point IDs and snap points length mismatch", () => {
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

    expect(() => {
      connectCustomers(hydraulicModel, {
        customerPointIds: ["CP1", "CP2"],
        pipeId: "P1",
        snapPoints: [[5, 0]], // Only one snap point for two customer points
      });
    }).toThrow(
      "Customer point IDs and snap points arrays must have the same length",
    );
  });

  it("throws error when pipe has no junction endpoints", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir("R1", { coordinates: [0, 0] })
      .aTank("T1", { coordinates: [10, 0] })
      .aPipe("P1", {
        startNodeId: "R1",
        endNodeId: "T1",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .aCustomerPoint("CP1", {
        coordinates: [5, 1],
      })
      .build();

    expect(() => {
      connectCustomers(hydraulicModel, {
        customerPointIds: ["CP1"],
        pipeId: "P1",
        snapPoints: [[5, 0]],
      });
    }).toThrow("No junction found to connect customer point CP1 to pipe P1");
  });

  it("ensures immutability by creating new instances", () => {
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
        coordinates: [2, 1],
      })
      .build();

    const originalCP = hydraulicModel.customerPoints.get("CP1")!;
    const originalJunction = hydraulicModel.assets.get("J1");

    const { putCustomerPoints, putAssets } = connectCustomers(hydraulicModel, {
      customerPointIds: ["CP1"],
      pipeId: "P1",
      snapPoints: [[2, 0]],
    });

    const connectedCP = putCustomerPoints![0];
    const updatedJunction = putAssets![0];

    expect(connectedCP).not.toBe(originalCP);
    expect(connectedCP.id).toBe(originalCP.id);
    expect(connectedCP.coordinates).toEqual(originalCP.coordinates);
    expect(connectedCP.connection).not.toBeNull();
    expect(originalCP.connection).toBeNull();

    expect(updatedJunction).not.toBe(originalJunction);
    expect(updatedJunction.id).toBe(originalJunction!.id);
  });

  it("handles connecting multiple customer points to same junction", () => {
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
        coordinates: [1, 1],
      })
      .aCustomerPoint("CP2", {
        coordinates: [2, 1],
      })
      .build();

    const { putCustomerPoints, putAssets } = connectCustomers(hydraulicModel, {
      customerPointIds: ["CP1", "CP2"],
      pipeId: "P1",
      snapPoints: [
        [1, 0],
        [2, 0],
      ], // Both closer to J1
    });

    expect(putCustomerPoints!.length).toBe(2);
    expect(putAssets!.length).toBe(1); // Only J1 modified

    const connectedCP1 = putCustomerPoints!.find((cp) => cp.id === "CP1")!;
    const connectedCP2 = putCustomerPoints!.find((cp) => cp.id === "CP2")!;

    expect(connectedCP1.connection!.junctionId).toBe("J1");
    expect(connectedCP2.connection!.junctionId).toBe("J1");

    const updatedJunction = putAssets![0];
    expect(updatedJunction.id).toBe("J1");
  });
});
