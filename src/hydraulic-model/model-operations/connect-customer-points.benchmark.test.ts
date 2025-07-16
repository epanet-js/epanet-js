/* eslint-disable no-console */
import { describe, it, expect } from "vitest";
import { connectCustomerPointsToPipes } from "./connect-customer-points";
import { createCustomerPoint } from "src/hydraulic-model/customer-points";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";

function generateGridNetwork(rows: number, cols: number) {
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

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const currentJunction = `J${row}_${col}`;

      if (col < cols - 1) {
        const rightJunction = `J${row}_${col + 1}`;
        const pipeId = `P${row}_${col}_R`;
        builder.aPipe(pipeId, {
          startNodeId: currentJunction,
          endNodeId: rightJunction,
          simulation: { flow: 10 + Math.random() * 5 },
        });
      }

      if (row < rows - 1) {
        const downJunction = `J${row + 1}_${col}`;
        const pipeId = `P${row}_${col}_D`;
        builder.aPipe(pipeId, {
          startNodeId: currentJunction,
          endNodeId: downJunction,
          simulation: { flow: 10 + Math.random() * 5 },
        });
      }
    }
  }

  return builder.build();
}

function generateCustomerPoints(
  count: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
) {
  const customerPoints = new Map();

  for (let i = 0; i < count; i++) {
    const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
    const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);

    const customerPoint = createCustomerPoint(
      [x, y],
      {
        name: `Customer_${i}`,
        demand: Math.random() * 50 + 10,
      },
      `CP${i}`,
    );

    customerPoints.set(`CP${i}`, customerPoint);
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

describe("Customer Points Connection Benchmark", () => {
  it("benchmarks 500k customer points connection", () => {
    console.log("DEBUG: Starting benchmark test setup...");

    const networkRows = 32;
    const networkCols = 32;
    const customerPointCount = 500000;

    console.log(
      `DEBUG: Generating ${networkRows}x${networkCols} grid network...`,
    );
    const networkStartTime = performance.now();
    const { assets } = generateGridNetwork(networkRows, networkCols);
    const networkEndTime = performance.now();
    console.log(
      `DEBUG: Network generation took ${(networkEndTime - networkStartTime).toFixed(2)}ms`,
    );
    console.log(`DEBUG: Generated ${assets.size} assets`);

    const networkBounds = {
      minX: -50,
      maxX: (networkCols - 1) * 100 + 50,
      minY: -50,
      maxY: (networkRows - 1) * 100 + 50,
    };

    console.log(`DEBUG: Generating ${customerPointCount} customer points...`);
    const customerPointsStartTime = performance.now();
    const customerPoints = generateCustomerPoints(
      customerPointCount,
      networkBounds,
    );
    const customerPointsEndTime = performance.now();
    console.log(
      `DEBUG: Customer points generation took ${(customerPointsEndTime - customerPointsStartTime).toFixed(2)}ms`,
    );

    const memoryBefore = measureMemoryUsage();
    console.log(
      `DEBUG: Memory usage before connection:`,
      `Heap: ${memoryBefore.heapUsed.toFixed(2)}MB/${memoryBefore.heapTotal.toFixed(2)}MB,`,
      `RSS: ${memoryBefore.rss.toFixed(2)}MB,`,
      `External: ${memoryBefore.external.toFixed(2)}MB`,
    );

    console.log(
      `DEBUG: Starting connection benchmark for ${customerPointCount} customer points...`,
    );
    const connectionStartTime = performance.now();

    const connectedPoints = connectCustomerPointsToPipes(
      customerPoints,
      assets,
    );

    const connectionEndTime = performance.now();
    const connectionTime = connectionEndTime - connectionStartTime;

    const memoryAfter = measureMemoryUsage();
    console.log(
      `DEBUG: Memory usage after connection:`,
      `Heap: ${memoryAfter.heapUsed.toFixed(2)}MB/${memoryAfter.heapTotal.toFixed(2)}MB,`,
      `RSS: ${memoryAfter.rss.toFixed(2)}MB,`,
      `External: ${memoryAfter.external.toFixed(2)}MB`,
    );
    console.log(
      `DEBUG: Memory increase:`,
      `Heap: ${(memoryAfter.heapUsed - memoryBefore.heapUsed).toFixed(2)}MB,`,
      `RSS: ${(memoryAfter.rss - memoryBefore.rss).toFixed(2)}MB,`,
      `External: ${(memoryAfter.external - memoryBefore.external).toFixed(2)}MB`,
    );

    console.log(
      `DEBUG: Connection benchmark completed in ${connectionTime.toFixed(2)}ms`,
    );
    console.log(
      `DEBUG: Performance: ${(customerPointCount / (connectionTime / 1000)).toFixed(0)} customer points per second`,
    );
    console.log(
      `DEBUG: Average time per customer point: ${((connectionTime / customerPointCount) * 1000).toFixed(2)}μs`,
    );

    let connectedCount = 0;
    let totalDistance = 0;

    for (const [, point] of connectedPoints) {
      if (point.connection) {
        connectedCount++;
        totalDistance += point.connection.distance;
      }
    }

    const connectionRate = (connectedCount / customerPointCount) * 100;
    const averageDistance =
      connectedCount > 0 ? totalDistance / connectedCount : 0;

    console.log(
      `DEBUG: Connected ${connectedCount}/${customerPointCount} customer points (${connectionRate.toFixed(1)}%)`,
    );
    console.log(
      `DEBUG: Average connection distance: ${averageDistance.toFixed(2)}m`,
    );

    expect(connectedPoints.size).toBe(customerPointCount);
    expect(connectedCount).toBeGreaterThan(customerPointCount * 0.9);

    expect(connectionTime).toBeLessThan(10000);
  });

  it("benchmarks smaller dataset for comparison", () => {
    console.log("DEBUG: Starting smaller benchmark for comparison...");

    const networkRows = 10;
    const networkCols = 10;
    const customerPointCount = 1000;

    const { assets } = generateGridNetwork(networkRows, networkCols);
    const networkBounds = {
      minX: -50,
      maxX: (networkCols - 1) * 100 + 50,
      minY: -50,
      maxY: (networkRows - 1) * 100 + 50,
    };

    const customerPoints = generateCustomerPoints(
      customerPointCount,
      networkBounds,
    );

    const connectionStartTime = performance.now();
    const connectedPoints = connectCustomerPointsToPipes(
      customerPoints,
      assets,
    );
    const connectionEndTime = performance.now();

    const connectionTime = connectionEndTime - connectionStartTime;

    console.log(
      `DEBUG: Small dataset (${customerPointCount} points) took ${connectionTime.toFixed(2)}ms`,
    );
    console.log(
      `DEBUG: Small dataset performance: ${(customerPointCount / (connectionTime / 1000)).toFixed(0)} customer points per second`,
    );

    expect(connectedPoints.size).toBe(customerPointCount);
    expect(connectionTime).toBeLessThan(1000);
  });
});
