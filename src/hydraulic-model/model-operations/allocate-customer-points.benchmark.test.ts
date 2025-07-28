/* eslint-disable no-console */
import { describe, it, expect } from "vitest";
import {
  HydraulicModelBuilder,
  buildCustomerPoint,
} from "src/__helpers__/hydraulic-model-builder";
import { CustomerPoints } from "src/hydraulic-model/customer-points";
import {
  allocateCustomerPoints,
  AllocationRule,
} from "./allocate-customer-points";

describe("Customer Points Allocation Benchmark", () => {
  const ruleSets = createRuleSets();

  it("benchmarks 1 rule with different dataset sizes", () => {
    console.log("DEBUG: === 1 RULE BENCHMARK ===");

    // Small dataset
    const smallModel = generateGridNetworkWithDiameters(8, 8);
    const smallPoints = generateScatteredCustomerPoints(1000, 8);
    runAllocationBenchmark(
      "1 rule - 1k points",
      smallModel,
      smallPoints,
      ruleSets.conservative,
    );

    // Medium dataset
    const mediumModel = generateGridNetworkWithDiameters(16, 16);
    const mediumPoints = generateScatteredCustomerPoints(50000, 16);
    runAllocationBenchmark(
      "1 rule - 50k points",
      mediumModel,
      mediumPoints,
      ruleSets.permissive,
    );

    expect(true).toBe(true); // Basic assertion
  });

  it("benchmarks 3 rules with progressive constraints", () => {
    console.log("DEBUG: === 3 RULES BENCHMARK ===");

    const model = generateGridNetworkWithDiameters(16, 16);
    const customerPoints = generateScatteredCustomerPoints(50000, 16);

    const result = runAllocationBenchmark(
      "3 rules - 50k points",
      model,
      customerPoints,
      ruleSets.progressive3,
    );

    expect(result.allocationsPerSecond).toBeGreaterThan(1000);
    expect(result.duration).toBeLessThan(60000); // 60 seconds max
  });

  it("benchmarks 5 rules with mixed constraints", () => {
    console.log("DEBUG: === 5 RULES BENCHMARK ===");

    const model = generateGridNetworkWithDiameters(16, 16);
    const customerPoints = generateScatteredCustomerPoints(50000, 16);

    const result = runAllocationBenchmark(
      "5 rules - 50k points",
      model,
      customerPoints,
      ruleSets.mixed5,
    );

    expect(result.allocationsPerSecond).toBeGreaterThan(800);
    expect(result.duration).toBeLessThan(80000); // 80 seconds max
  });

  it("benchmarks 10 rules with complex constraints", () => {
    console.log("DEBUG: === 10 RULES BENCHMARK ===");

    const model = generateGridNetworkWithDiameters(16, 16);
    const customerPoints = generateScatteredCustomerPoints(50000, 16);

    const result = runAllocationBenchmark(
      "10 rules - 50k points",
      model,
      customerPoints,
      ruleSets.complex10,
    );

    expect(result.allocationsPerSecond).toBeGreaterThan(500);
    expect(result.duration).toBeLessThan(120000); // 2 minutes max
  });

  it("benchmarks large dataset with variable rule counts", () => {
    console.log("DEBUG: === LARGE DATASET BENCHMARK ===");

    const largeModel = generateGridNetworkWithDiameters(32, 32);
    const largePoints = generateScatteredCustomerPoints(500000, 32);

    // Test with 1 rule
    runAllocationBenchmark(
      "1 rule - 500k points",
      largeModel,
      largePoints,
      ruleSets.permissive,
    );

    // Test with 3 rules
    runAllocationBenchmark(
      "3 rules - 500k points",
      largeModel,
      largePoints,
      ruleSets.progressive3,
    );

    // Test with 10 rules
    const result = runAllocationBenchmark(
      "10 rules - 500k points",
      largeModel,
      largePoints,
      ruleSets.complex10,
    );

    expect(result.allocationsPerSecond).toBeGreaterThan(100);
    expect(result.duration).toBeLessThan(300000); // 5 minutes max
  });
});

function generateGridNetworkWithDiameters(rows: number, cols: number) {
  const builder = HydraulicModelBuilder.with();
  const spacing = 100;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const junctionId = `J${row}_${col}`;
      const x = col * spacing;
      const y = row * spacing;

      builder.aJunction(junctionId, {
        coordinates: [x, y],
        simulation: { pressure: 20 + Math.random() * 10 },
      });
    }
  }

  const diameters = [6, 8, 12, 16, 20, 24];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const currentJunction = `J${row}_${col}`;

      if (col < cols - 1) {
        const rightJunction = `J${row}_${col + 1}`;
        const pipeId = `P${row}_${col}_R`;
        const diameter =
          diameters[Math.floor(Math.random() * diameters.length)];
        builder.aPipe(pipeId, {
          startNodeId: currentJunction,
          endNodeId: rightJunction,
          diameter,
          simulation: { flow: 10 + Math.random() * 5 },
        });
      }

      if (row < rows - 1) {
        const downJunction = `J${row + 1}_${col}`;
        const pipeId = `P${row}_${col}_D`;
        const diameter =
          diameters[Math.floor(Math.random() * diameters.length)];
        builder.aPipe(pipeId, {
          startNodeId: currentJunction,
          endNodeId: downJunction,
          diameter,
          simulation: { flow: 10 + Math.random() * 5 },
        });
      }
    }
  }

  return builder.build();
}

function generateScatteredCustomerPoints(
  count: number,
  gridSize: number,
): CustomerPoints {
  const customerPoints: CustomerPoints = new Map();
  const spacing = 100;
  const maxCoord = (gridSize - 1) * spacing;

  for (let i = 0; i < count; i++) {
    // Generate points with some clustering around pipe network
    // Add small random offset from grid points to simulate real customer locations
    const baseX = Math.floor(Math.random() * gridSize) * spacing;
    const baseY = Math.floor(Math.random() * gridSize) * spacing;

    // Add random offset within reasonable distance of pipes (±50m)
    const x = baseX + (Math.random() - 0.5) * 100;
    const y = baseY + (Math.random() - 0.5) * 100;

    // Ensure coordinates stay within bounds
    const clampedX = Math.max(0, Math.min(maxCoord, x));
    const clampedY = Math.max(0, Math.min(maxCoord, y));

    const demand = Math.random() * 100;

    const customerPoint = buildCustomerPoint(`CP${i + 1}`, {
      coordinates: [clampedX, clampedY],
      demand,
    });

    customerPoints.set(`CP${i + 1}`, customerPoint);
  }

  return customerPoints;
}

function measureMemoryUsage(): {
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
} {
  if (typeof global !== "undefined" && global.gc) {
    global.gc();
  }

  const memUsage = process.memoryUsage();
  return {
    heapUsed: memUsage.heapUsed / 1024 / 1024,
    heapTotal: memUsage.heapTotal / 1024 / 1024,
    rss: memUsage.rss / 1024 / 1024,
    external: memUsage.external / 1024 / 1024,
  };
}

function createRuleSets() {
  return {
    conservative: [{ maxDistance: 50, maxDiameter: 6 }],
    medium: [{ maxDistance: 150, maxDiameter: 12 }],
    permissive: [{ maxDistance: 300, maxDiameter: 24 }],
    progressive3: [
      { maxDistance: 50, maxDiameter: 6 },
      { maxDistance: 150, maxDiameter: 12 },
      { maxDistance: 300, maxDiameter: 24 },
    ],
    mixed5: [
      { maxDistance: 30, maxDiameter: 8 },
      { maxDistance: 100, maxDiameter: 16 },
      { maxDistance: 200, maxDiameter: 12 },
      { maxDistance: 250, maxDiameter: 20 },
      { maxDistance: 400, maxDiameter: 24 },
    ],
    complex10: [
      { maxDistance: 25, maxDiameter: 6 },
      { maxDistance: 50, maxDiameter: 8 },
      { maxDistance: 75, maxDiameter: 10 },
      { maxDistance: 100, maxDiameter: 12 },
      { maxDistance: 150, maxDiameter: 14 },
      { maxDistance: 200, maxDiameter: 16 },
      { maxDistance: 250, maxDiameter: 18 },
      { maxDistance: 300, maxDiameter: 20 },
      { maxDistance: 400, maxDiameter: 22 },
      { maxDistance: 500, maxDiameter: 24 },
    ],
  };
}

function runAllocationBenchmark(
  testName: string,
  hydraulicModel: ReturnType<typeof generateGridNetworkWithDiameters>,
  customerPoints: CustomerPoints,
  allocationRules: AllocationRule[],
) {
  console.log(`DEBUG: Starting ${testName}...`);
  console.log(`DEBUG: Dataset size: ${customerPoints.size} customer points`);
  console.log(`DEBUG: Rules: ${allocationRules.length}`);

  const memBefore = measureMemoryUsage();
  const startTime = performance.now();

  const result = allocateCustomerPoints(hydraulicModel, {
    allocationRules,
    customerPoints,
  });

  const endTime = performance.now();
  const memAfter = measureMemoryUsage();

  const duration = endTime - startTime;
  const allocationsPerSecond = Math.round(
    customerPoints.size / (duration / 1000),
  );
  const allocatedCount = result.allocatedCustomerPoints.size;
  const successRate = ((allocatedCount / customerPoints.size) * 100).toFixed(1);

  console.log(`DEBUG: Time spent: ${duration.toFixed(2)}ms`);
  console.log(`DEBUG: Performance: ${allocationsPerSecond} allocations/second`);
  console.log(
    `DEBUG: Success rate: ${successRate}% (${allocatedCount}/${customerPoints.size})`,
  );
  console.log(`DEBUG: Rule matches: [${result.ruleMatches.join(", ")}]`);
  console.log(
    `DEBUG: Memory increase: ${(memAfter.heapUsed - memBefore.heapUsed).toFixed(2)}MB`,
  );

  if (allocatedCount > 0) {
    const totalDistance = Array.from(result.allocatedCustomerPoints.values())
      .filter((cp) => cp.connection)
      .reduce((sum, cp) => sum + cp.connection!.distance, 0);
    const avgDistance = totalDistance / allocatedCount;
    console.log(`DEBUG: Average distance: ${avgDistance.toFixed(2)}m`);
  }

  console.log(`DEBUG: Completed ${testName}\n`);

  return {
    duration,
    allocationsPerSecond,
    allocatedCount,
    successRate: parseFloat(successRate),
    ruleMatches: result.ruleMatches,
    memoryIncrease: memAfter.heapUsed - memBefore.heapUsed,
  };
}
