import { describe, it, expect } from "vitest";
import { allocateCustomerPoints } from "./main";
import { AllocationRule } from "./types";
import {
  HydraulicModelBuilder,
  buildCustomerPoint,
} from "src/__helpers__/hydraulic-model-builder";
import { CustomerPoints } from "../../customer-points";

describe("allocateCustomerPoints", () => {
  it("allocates customer points based on single rule", async () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4, CP2: 5 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [-95.4089633, 29.701228] })
      .aJunction(IDS.J2, { coordinates: [-95.4077939, 29.702706] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 12,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .build();

    const customerPoints: CustomerPoints = new Map([
      [
        IDS.CP1,
        buildCustomerPoint(IDS.CP1, {
          coordinates: [-95.4084, 29.7019],
          demands: [{ baseDemand: 50 }],
        }),
      ],
      [
        IDS.CP2,
        buildCustomerPoint(IDS.CP2, {
          coordinates: [-95.4082, 29.7018],
          demands: [{ baseDemand: 30 }],
        }),
      ],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const result = await allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    expect(result.allocatedCustomerPoints.size).toBe(2);
    expect(result.disconnectedCustomerPoints.size).toBe(0);
    expect(result.ruleMatches).toEqual([2]);

    const allocatedCP1 = result.allocatedCustomerPoints.get(IDS.CP1);
    expect(allocatedCP1?.connection?.pipeId).toBe(IDS.P1);
    expect(allocatedCP1?.connection?.junctionId).toBe(IDS.J1);
  });

  it("applies rules in order with first match wins", async () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [-95.4089633, 29.701228] })
      .aJunction(IDS.J2, { coordinates: [-95.4077939, 29.702706] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 8,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .build();

    const customerPoints: CustomerPoints = new Map([
      [
        IDS.CP1,
        buildCustomerPoint(IDS.CP1, { coordinates: [-95.4084, 29.7019] }),
      ],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 10 },
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const result = await allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    expect(result.allocatedCustomerPoints.size).toBe(1);
    expect(result.disconnectedCustomerPoints.size).toBe(0);
    expect(result.ruleMatches).toEqual([1, 0]);
  });

  it("filters by maximum distance", async () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4, CP2: 5 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [-95.4089633, 29.701228] })
      .aJunction(IDS.J2, { coordinates: [-95.4077939, 29.702706] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 12,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .build();

    const customerPoints: CustomerPoints = new Map([
      [
        IDS.CP1,
        buildCustomerPoint(IDS.CP1, { coordinates: [-95.4084, 29.7019] }),
      ],
      [IDS.CP2, buildCustomerPoint(IDS.CP2, { coordinates: [-95.4, 29.8] })],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const result = await allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    expect(result.allocatedCustomerPoints.size).toBe(1);
    expect(result.allocatedCustomerPoints.has(IDS.CP1)).toBe(true);
    expect(result.allocatedCustomerPoints.has(IDS.CP2)).toBe(false);
    expect(result.disconnectedCustomerPoints.size).toBe(1);
    expect(result.disconnectedCustomerPoints.has(IDS.CP2)).toBe(true);
    expect(result.ruleMatches).toEqual([1]);
  });

  it("filters by maximum diameter", async () => {
    const IDS = {
      J1: 1,
      J2: 2,
      J3: 3,
      J4: 4,
      P1: 5,
      P2: 6,
      CP1: 7,
      CP2: 8,
    } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [-95.4089633, 29.701228] })
      .aJunction(IDS.J2, { coordinates: [-95.4077939, 29.702706] })
      .aJunction(IDS.J3, { coordinates: [-95.4089633, 29.710228] })
      .aJunction(IDS.J4, { coordinates: [-95.4077939, 29.711706] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 8,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J3,
        endNodeId: IDS.J4,
        diameter: 16,
        coordinates: [
          [-95.4089633, 29.710228],
          [-95.4077939, 29.711706],
        ],
      })
      .build();

    const customerPoints: CustomerPoints = new Map([
      [
        IDS.CP1,
        buildCustomerPoint(IDS.CP1, { coordinates: [-95.4084, 29.7019] }),
      ],
      [
        IDS.CP2,
        buildCustomerPoint(IDS.CP2, { coordinates: [-95.4084, 29.7109] }),
      ],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 10 },
    ];

    const result = await allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    expect(result.allocatedCustomerPoints.size).toBe(1);
    const allocatedCP1 = result.allocatedCustomerPoints.get(IDS.CP1);
    expect(allocatedCP1?.connection?.pipeId).toBe(IDS.P1);
    expect(result.allocatedCustomerPoints.has(IDS.CP2)).toBe(false);
    expect(result.disconnectedCustomerPoints.size).toBe(1);
    expect(result.disconnectedCustomerPoints.has(IDS.CP2)).toBe(true);
    expect(result.ruleMatches).toEqual([1]);
  });

  it("handles multiple rules with different constraints", async () => {
    const IDS = {
      J1: 1,
      J2: 2,
      J3: 3,
      J4: 4,
      P1: 5,
      P2: 6,
      CP1: 7,
      CP2: 8,
    } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [-95.4089633, 29.701228] })
      .aJunction(IDS.J2, { coordinates: [-95.4077939, 29.702706] })
      .aJunction(IDS.J3, { coordinates: [-95.4089633, 29.710228] })
      .aJunction(IDS.J4, { coordinates: [-95.4077939, 29.711706] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 8,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J3,
        endNodeId: IDS.J4,
        diameter: 16,
        coordinates: [
          [-95.4089633, 29.710228],
          [-95.4077939, 29.711706],
        ],
      })
      .build();

    const customerPoints: CustomerPoints = new Map([
      [
        IDS.CP1,
        buildCustomerPoint(IDS.CP1, { coordinates: [-95.4084, 29.7019] }),
      ],
      [
        IDS.CP2,
        buildCustomerPoint(IDS.CP2, { coordinates: [-95.4084, 29.7109] }),
      ],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 10 },
      { maxDistance: 200, maxDiameter: 20 },
    ];

    const result = await allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    expect(result.allocatedCustomerPoints.size).toBe(2);
    expect(result.disconnectedCustomerPoints.size).toBe(0);
    expect(result.ruleMatches).toEqual([1, 1]);

    const allocatedCP1 = result.allocatedCustomerPoints.get(IDS.CP1);
    const allocatedCP2 = result.allocatedCustomerPoints.get(IDS.CP2);
    expect(allocatedCP1?.connection?.pipeId).toBe(IDS.P1);
    expect(allocatedCP2?.connection?.pipeId).toBe(IDS.P2);
  });

  it("handles empty customer points", async () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [-95.4089633, 29.701228] })
      .aJunction(IDS.J2, { coordinates: [-95.4077939, 29.702706] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 12,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .build();

    const customerPoints: CustomerPoints = new Map();
    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const result = await allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    expect(result.allocatedCustomerPoints.size).toBe(0);
    expect(result.disconnectedCustomerPoints.size).toBe(0);
    expect(result.ruleMatches).toEqual([0]);
  });

  it("handles no pipes in hydraulic model", async () => {
    const IDS = { J1: 1, CP1: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [-95.4089633, 29.701228] })
      .build();

    const customerPoints: CustomerPoints = new Map([
      [
        IDS.CP1,
        buildCustomerPoint(IDS.CP1, { coordinates: [-95.4084, 29.7019] }),
      ],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const result = await allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    expect(result.allocatedCustomerPoints.size).toBe(0);
    expect(result.disconnectedCustomerPoints.size).toBe(1);
    expect(result.disconnectedCustomerPoints.has(IDS.CP1)).toBe(true);
    expect(result.ruleMatches).toEqual([0]);
  });

  it("handles customer points that match no rules", async () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [-95.4089633, 29.701228] })
      .aJunction(IDS.J2, { coordinates: [-95.4077939, 29.702706] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 20,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .build();

    const customerPoints: CustomerPoints = new Map([
      [
        IDS.CP1,
        buildCustomerPoint(IDS.CP1, { coordinates: [-95.4084, 29.7019] }),
      ],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 10 },
    ];

    const result = await allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    expect(result.allocatedCustomerPoints.size).toBe(0);
    expect(result.disconnectedCustomerPoints.size).toBe(1);
    expect(result.disconnectedCustomerPoints.has(IDS.CP1)).toBe(true);
    expect(result.ruleMatches).toEqual([0]);
  });

  it("preserves immutability of input customer points", async () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [-95.4089633, 29.701228] })
      .aJunction(IDS.J2, { coordinates: [-95.4077939, 29.702706] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 12,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .build();

    const originalCustomerPoint = buildCustomerPoint(IDS.CP1, {
      coordinates: [-95.4084, 29.7019],
      demands: [{ baseDemand: 50 }],
    });
    const customerPoints: CustomerPoints = new Map([
      [IDS.CP1, originalCustomerPoint],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    await allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    expect(originalCustomerPoint.connection).toBeNull();
    expect(originalCustomerPoint.baseDemand).toBe(50);
  });

  it("excludes tanks and reservoirs from junction assignment", async () => {
    const IDS = { T1: 1, R1: 2, P1: 3, CP1: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aTank(IDS.T1, { coordinates: [-95.4089633, 29.701228] })
      .aReservoir(IDS.R1, { coordinates: [-95.4077939, 29.702706] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.T1,
        endNodeId: IDS.R1,
        diameter: 12,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .build();

    const customerPoints: CustomerPoints = new Map([
      [
        IDS.CP1,
        buildCustomerPoint(IDS.CP1, { coordinates: [-95.4084, 29.7019] }),
      ],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const result = await allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    expect(result.allocatedCustomerPoints.size).toBe(0);
    expect(result.disconnectedCustomerPoints.size).toBe(1);
    expect(result.disconnectedCustomerPoints.has(IDS.CP1)).toBe(true);
    expect(result.ruleMatches).toEqual([0]);
  });

  it("assigns to closest junction when pipe has multiple junctions", async () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [-95.4089633, 29.701228] })
      .aJunction(IDS.J2, { coordinates: [-95.4077939, 29.702706] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 12,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .build();

    const customerPoints: CustomerPoints = new Map([
      [
        IDS.CP1,
        buildCustomerPoint(IDS.CP1, { coordinates: [-95.4078, 29.7026] }),
      ],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const result = await allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    expect(result.allocatedCustomerPoints.size).toBe(1);
    const allocatedCP1 = result.allocatedCustomerPoints.get(IDS.CP1);
    expect(allocatedCP1?.connection?.junctionId).toBe(IDS.J2);
  });

  it("creates independent customer point copies", async () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [-95.4089633, 29.701228] })
      .aJunction(IDS.J2, { coordinates: [-95.4077939, 29.702706] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 12,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .build();

    const originalCustomerPoint = buildCustomerPoint(IDS.CP1, {
      coordinates: [-95.4084, 29.7019],
      demands: [{ baseDemand: 50 }],
    });
    const customerPoints: CustomerPoints = new Map([
      [IDS.CP1, originalCustomerPoint],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const result = await allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    const allocatedCP1 = result.allocatedCustomerPoints.get(IDS.CP1);
    expect(allocatedCP1).not.toBe(originalCustomerPoint);
    expect(allocatedCP1?.id).toBe(originalCustomerPoint.id);
    expect(allocatedCP1?.baseDemand).toBe(originalCustomerPoint.baseDemand);
  });

  it("creates independent copies for disconnected customer points", async () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [-95.4089633, 29.701228] })
      .aJunction(IDS.J2, { coordinates: [-95.4077939, 29.702706] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 8,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .build();

    const originalCustomerPoint = buildCustomerPoint(IDS.CP1, {
      coordinates: [-95.4084, 29.7019],
      demands: [{ baseDemand: 50 }],
    });
    const customerPoints: CustomerPoints = new Map([
      [IDS.CP1, originalCustomerPoint],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 6 },
    ];

    const result = await allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    expect(result.allocatedCustomerPoints.size).toBe(0);
    expect(result.disconnectedCustomerPoints.size).toBe(1);

    const disconnectedCP1 = result.disconnectedCustomerPoints.get(IDS.CP1);
    expect(disconnectedCP1).not.toBe(originalCustomerPoint);
    expect(disconnectedCP1?.id).toBe(originalCustomerPoint.id);
    expect(disconnectedCP1?.baseDemand).toBe(originalCustomerPoint.baseDemand);
    expect(disconnectedCP1?.connection).toBeNull();
    expect(originalCustomerPoint.connection).toBeNull();
  });

  it("preserves total customer points count across allocated and disconnected", async () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4, CP2: 5, CP3: 6 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [-95.4089633, 29.701228] })
      .aJunction(IDS.J2, { coordinates: [-95.4077939, 29.702706] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 12,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .build();

    const customerPoints: CustomerPoints = new Map([
      [
        IDS.CP1,
        buildCustomerPoint(IDS.CP1, { coordinates: [-95.4084, 29.7019] }),
      ],
      [IDS.CP2, buildCustomerPoint(IDS.CP2, { coordinates: [-95.4, 29.8] })],
      [
        IDS.CP3,
        buildCustomerPoint(IDS.CP3, { coordinates: [-95.4082, 29.7018] }),
      ],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const result = await allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    const totalProcessed =
      result.allocatedCustomerPoints.size +
      result.disconnectedCustomerPoints.size;
    expect(totalProcessed).toBe(customerPoints.size);
    expect(totalProcessed).toBe(3);
    expect(result.allocatedCustomerPoints.size).toBe(2);
    expect(result.disconnectedCustomerPoints.size).toBe(1);
    expect(result.disconnectedCustomerPoints.has(IDS.CP2)).toBe(true);
  });
});

describe("findNearestPipeConnectionWithWorkerData optimization", () => {
  it("returns same results as original implementation", async () => {
    const IDS = {
      J1: 1,
      J2: 2,
      J3: 3,
      J4: 4,
      P1: 5,
      P2: 6,
      CP1: 7,
      CP2: 8,
    } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [-95.4089633, 29.701228] })
      .aJunction(IDS.J2, { coordinates: [-95.4077939, 29.702706] })
      .aJunction(IDS.J3, { coordinates: [-95.4089633, 29.710228] })
      .aJunction(IDS.J4, { coordinates: [-95.4077939, 29.711706] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 8,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J3,
        endNodeId: IDS.J4,
        diameter: 12,
        coordinates: [
          [-95.4089633, 29.710228],
          [-95.4077939, 29.711706],
        ],
      })
      .build();

    const customerPoints: CustomerPoints = new Map([
      [
        IDS.CP1,
        buildCustomerPoint(IDS.CP1, { coordinates: [-95.4084, 29.7019] }),
      ],
      [
        IDS.CP2,
        buildCustomerPoint(IDS.CP2, { coordinates: [-95.4084, 29.7109] }),
      ],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 10 },
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const result = await allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    expect(result.allocatedCustomerPoints.size).toBe(2);
    expect(result.disconnectedCustomerPoints.size).toBe(0);
    expect(result.ruleMatches).toEqual([1, 1]);

    const allocatedCP1 = result.allocatedCustomerPoints.get(IDS.CP1);
    const allocatedCP2 = result.allocatedCustomerPoints.get(IDS.CP2);

    expect(allocatedCP1?.connection?.pipeId).toBe(IDS.P1);
    expect(allocatedCP1?.connection?.junctionId).toBeTruthy();

    expect(allocatedCP2?.connection?.pipeId).toBe(IDS.P2);
    expect(allocatedCP2?.connection?.junctionId).toBeTruthy();
  });

  it("demonstrates early termination with close match", async () => {
    const IDS = { J1: 1, J2: 2, J3: 3, J4: 4, P1: 5, P2: 6, CP1: 7 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [-95.4089633, 29.701228] })
      .aJunction(IDS.J2, { coordinates: [-95.4077939, 29.702706] })
      .aJunction(IDS.J3, { coordinates: [-95.4089633, 29.75] })
      .aJunction(IDS.J4, { coordinates: [-95.4077939, 29.75] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 12,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J3,
        endNodeId: IDS.J4,
        diameter: 12,
        coordinates: [
          [-95.4089633, 29.75],
          [-95.4077939, 29.75],
        ],
      })
      .build();

    const customerPoints: CustomerPoints = new Map([
      [
        IDS.CP1,
        buildCustomerPoint(IDS.CP1, { coordinates: [-95.4084, 29.7019] }),
      ],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 100, maxDiameter: 15 },
    ];

    const result = await allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    expect(result.allocatedCustomerPoints.size).toBe(1);
    expect(result.disconnectedCustomerPoints.size).toBe(0);
    const allocatedCP1 = result.allocatedCustomerPoints.get(IDS.CP1);
    expect(allocatedCP1?.connection?.pipeId).toBe(IDS.P1);
  });
});
