/* eslint-disable no-console */
import { describe, it, expect } from "vitest";
import { createSpatialIndex } from "src/hydraulic-model/spatial-index";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { getAssetsByType } from "src/__helpers__/asset-queries";
import { Pipe } from "src/hydraulic-model/asset-types/pipe";
import { parseCustomerPoints } from "src/import/parse-customer-points";
import { connectCustomerPoint } from "src/hydraulic-model/mutations/connect-customer-point";
import { initializeCustomerPoints } from "src/hydraulic-model/customer-points";
import { CustomerPointsIssuesAccumulator } from "src/import/parse-customer-points-issues";

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

function generateCustomerPoints(count: number): string[] {
  const lines: string[] = [];

  for (let i = 0; i < count; i++) {
    const x = Math.random() * 3100;
    const y = Math.random() * 3100;
    const feature = {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [x, y],
      },
      properties: {
        id: i + 1,
        demand: Math.random() * 100,
      },
    };
    lines.push(JSON.stringify(feature));
  }

  return lines;
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

describe("Customer Points Streaming Connection Benchmark", () => {
  it("benchmarks 500k customer points streaming connection", () => {
    console.log("DEBUG: Starting streaming benchmark test setup...");

    console.log("DEBUG: Generating 32x32 grid network...");
    const startNetworkGen = performance.now();
    const hydraulicModel = generateGridNetwork(32, 32);
    const { assets } = hydraulicModel;
    const endNetworkGen = performance.now();
    console.log(
      `DEBUG: Network generation took ${(endNetworkGen - startNetworkGen).toFixed(2)}ms`,
    );
    console.log(`DEBUG: Generated ${assets.size} assets`);

    const pipes = getAssetsByType<Pipe>(assets, "pipe");
    const spatialIndexData = createSpatialIndex(pipes);

    console.log("DEBUG: Generating 500000 customer points...");
    const startPointsGen = performance.now();
    const customerPointsLines = generateCustomerPoints(500000);
    const fileContent = customerPointsLines.join("\n");
    const endPointsGen = performance.now();
    console.log(
      `DEBUG: Customer points generation took ${(endPointsGen - startPointsGen).toFixed(2)}ms`,
    );

    const memBefore = measureMemoryUsage();
    console.log(
      `DEBUG: Memory usage before connection: Heap: ${memBefore.heapUsed.toFixed(2)}MB/${memBefore.heapTotal.toFixed(2)}MB, RSS: ${memBefore.rss.toFixed(2)}MB, External: ${memBefore.external.toFixed(2)}MB`,
    );

    console.log(
      "DEBUG: Starting streaming connection benchmark for 500000 customer points...",
    );
    const startConnection = performance.now();

    const issues = new CustomerPointsIssuesAccumulator();
    const mutableHydraulicModel = {
      ...hydraulicModel,
      customerPoints: initializeCustomerPoints(),
    };

    for (const customerPoint of parseCustomerPoints(fileContent, issues, 1)) {
      connectCustomerPoint(
        mutableHydraulicModel,
        spatialIndexData,
        customerPoint,
      );
    }

    const result = {
      customerPoints: mutableHydraulicModel.customerPoints,
      issues: issues.buildResult(),
    };

    const endConnection = performance.now();
    const memAfter = measureMemoryUsage();

    console.log(
      `DEBUG: Memory usage after connection: Heap: ${memAfter.heapUsed.toFixed(2)}MB/${memAfter.heapTotal.toFixed(2)}MB, RSS: ${memAfter.rss.toFixed(2)}MB, External: ${memAfter.external.toFixed(2)}MB`,
    );
    console.log(
      `DEBUG: Memory increase: Heap: ${(memAfter.heapUsed - memBefore.heapUsed).toFixed(2)}MB, RSS: ${(memAfter.rss - memBefore.rss).toFixed(2)}MB, External: ${(memAfter.external - memBefore.external).toFixed(2)}MB`,
    );

    const connectionTime = endConnection - startConnection;
    console.log(
      `DEBUG: Streaming connection benchmark completed in ${connectionTime.toFixed(2)}ms`,
    );

    const pointsPerSecond = Math.round(500000 / (connectionTime / 1000));
    console.log(
      `DEBUG: Performance: ${pointsPerSecond} customer points per second`,
    );

    const avgTimePerPoint = (connectionTime * 1000) / 500000;
    console.log(
      `DEBUG: Average time per customer point: ${avgTimePerPoint.toFixed(2)}μs`,
    );

    const connectedCount = Array.from(result.customerPoints.values()).filter(
      (cp) => cp.connection,
    ).length;
    console.log(
      `DEBUG: Connected ${connectedCount}/${result.customerPoints.size} customer points (${((connectedCount / result.customerPoints.size) * 100).toFixed(1)}%)`,
    );

    if (connectedCount > 0) {
      const totalDistance = Array.from(result.customerPoints.values())
        .filter((cp) => cp.connection)
        .reduce((sum, cp) => sum + cp.connection!.distance, 0);
      const avgDistance = totalDistance / connectedCount;
      console.log(
        `DEBUG: Average connection distance: ${avgDistance.toFixed(2)}m`,
      );
    }

    expect(result.customerPoints.size).toBe(500000);
    expect(connectionTime).toBeLessThan(15000);
    expect(pointsPerSecond).toBeGreaterThan(30000);
  });

  it("benchmarks smaller dataset for comparison", () => {
    console.log(
      "DEBUG: Starting smaller streaming benchmark for comparison...",
    );

    const hydraulicModel = generateGridNetwork(8, 8);
    const { assets } = hydraulicModel;
    const pipes = getAssetsByType<Pipe>(assets, "pipe");
    const spatialIndexData = createSpatialIndex(pipes);

    const customerPointsLines = generateCustomerPoints(1000);
    const fileContent = customerPointsLines.join("\n");

    const startTime = performance.now();
    const issues = new CustomerPointsIssuesAccumulator();
    const mutableHydraulicModel = {
      ...hydraulicModel,
      customerPoints: initializeCustomerPoints(),
    };

    for (const customerPoint of parseCustomerPoints(fileContent, issues, 1)) {
      connectCustomerPoint(
        mutableHydraulicModel,
        spatialIndexData,
        customerPoint,
      );
    }

    const result = {
      customerPoints: mutableHydraulicModel.customerPoints,
      issues: issues.buildResult(),
    };
    const endTime = performance.now();

    const duration = endTime - startTime;
    const pointsPerSecond = Math.round(1000 / (duration / 1000));

    console.log(
      `DEBUG: Small dataset (1000 points) took ${duration.toFixed(2)}ms`,
    );
    console.log(
      `DEBUG: Small dataset performance: ${pointsPerSecond} customer points per second`,
    );

    expect(result.customerPoints.size).toBe(1000);
    expect(duration).toBeLessThan(100);
  });
});
