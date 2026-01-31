import { describe, expect, it, beforeEach } from "vitest";
import { EPSResultsReader } from "./eps-results-reader";
import { InMemoryStorage } from "src/infra/storage";
import {
  PROLOG_SIZE,
  EPILOG_SIZE,
  type SimulationIds,
} from "./simulation-metadata";

// IDs used in fixtures - these correspond to node/link indices
const IDS = {
  TANK: 3, // Tank is node N3 (index 2, but ID is 3)
} as const;

const FLOAT_SIZE = 4;
const ID_LENGTH = 32;
const NODE_RESULT_FLOATS = 4; // demand, head, pressure, quality
const LINK_RESULT_FLOATS = 8;

/**
 * Creates fixture data for EPSResultsReader unit tests.
 * This allows testing the reader in isolation without running a full simulation.
 *
 * Node results format follows EPANET binary output: all demands first, then all heads,
 * then all pressures, then all qualities (NOT interleaved per node).
 */
// Pressure units: 0=psi, 1=kPa, 2=meters, 3=bar, 4=feet
type PressureUnitsCode = 0 | 1 | 2 | 3 | 4;

function createFixture(config: {
  nodeCount: number;
  linkCount: number;
  resAndTankCount: number;
  pumpCount: number;
  timestepCount: number;
  reportingTimeStep?: number;
  pressureUnits?: PressureUnitsCode;
  // Node results: [timestep][allDemands..., allHeads..., allPressures..., allQualities...]
  nodeResults?: number[][];
  linkResults?: number[][]; // [timestep][linkIndex * 8 + propertyIndex]
  tankVolumes?: number[][]; // [timestep][tankIndex]
}) {
  const {
    nodeCount,
    linkCount,
    resAndTankCount,
    pumpCount,
    timestepCount,
    reportingTimeStep = 3600,
    pressureUnits = 2, // default to meters (SI units)
  } = config;

  // Create prolog + epilog metadata
  const metadata = new ArrayBuffer(PROLOG_SIZE + EPILOG_SIZE);
  const prologView = new DataView(metadata, 0, PROLOG_SIZE);
  const epilogView = new DataView(metadata, PROLOG_SIZE, EPILOG_SIZE);

  prologView.setInt32(8, nodeCount, true);
  prologView.setInt32(12, resAndTankCount, true);
  prologView.setInt32(16, linkCount, true);
  prologView.setInt32(20, pumpCount, true);
  prologView.setInt32(24, 0, true); // valveCount
  prologView.setInt32(40, pressureUnits, true); // pressureUnits
  prologView.setInt32(48, 0, true); // reportingStartTime
  prologView.setInt32(52, reportingTimeStep, true);
  prologView.setInt32(56, timestepCount * reportingTimeStep, true); // simulationDuration
  epilogView.setInt32(0, timestepCount, true);

  // Create results.out file
  const nodeIdsSize = nodeCount * ID_LENGTH;
  const linkIdsSize = linkCount * ID_LENGTH;
  const linkInfoSize = 3 * FLOAT_SIZE * linkCount; // 3 floats per link
  const tankInfoSize = 2 * FLOAT_SIZE * resAndTankCount; // 2 floats per tank
  const nodeElevationsSize = FLOAT_SIZE * nodeCount;
  const linkLengthsSize = 2 * FLOAT_SIZE * linkCount;
  const pumpEnergySize = 7 * FLOAT_SIZE * pumpCount;
  const paddingSize = 4;

  const timestepBlockSize =
    nodeCount * NODE_RESULT_FLOATS * FLOAT_SIZE +
    linkCount * LINK_RESULT_FLOATS * FLOAT_SIZE;

  const resultsBaseOffset =
    PROLOG_SIZE +
    nodeIdsSize +
    linkIdsSize +
    linkInfoSize +
    tankInfoSize +
    nodeElevationsSize +
    linkLengthsSize +
    pumpEnergySize +
    paddingSize;

  const resultsOutSize =
    resultsBaseOffset + timestepCount * timestepBlockSize + EPILOG_SIZE;

  const resultsOut = new ArrayBuffer(resultsOutSize);
  const resultsOutView = new Uint8Array(resultsOut);

  // Copy prolog to results.out
  resultsOutView.set(new Uint8Array(metadata, 0, PROLOG_SIZE), 0);

  // Write node IDs (after prolog) - use numeric strings to match interface
  const nodeIdsOffset = PROLOG_SIZE;
  for (let i = 0; i < nodeCount; i++) {
    const id = String(i + 1);
    const encoder = new TextEncoder();
    const encoded = encoder.encode(id);
    resultsOutView.set(encoded, nodeIdsOffset + i * ID_LENGTH);
  }

  // Write link IDs - use numeric strings to match interface
  const linkIdsOffset = nodeIdsOffset + nodeIdsSize;
  for (let i = 0; i < linkCount; i++) {
    const id = String(i + 1);
    const encoder = new TextEncoder();
    const encoded = encoder.encode(id);
    resultsOutView.set(encoded, linkIdsOffset + i * ID_LENGTH);
  }

  // Write node results for each timestep
  const resultsDataView = new DataView(resultsOut);
  if (config.nodeResults) {
    for (let t = 0; t < timestepCount; t++) {
      const timestepOffset = resultsBaseOffset + t * timestepBlockSize;
      const nodeData = config.nodeResults[t] ?? [];
      for (let i = 0; i < nodeData.length; i++) {
        resultsDataView.setFloat32(
          timestepOffset + i * FLOAT_SIZE,
          nodeData[i],
          true,
        );
      }
    }
  }

  // Write link results for each timestep
  if (config.linkResults) {
    for (let t = 0; t < timestepCount; t++) {
      const timestepOffset = resultsBaseOffset + t * timestepBlockSize;
      const linkDataOffset =
        timestepOffset + nodeCount * NODE_RESULT_FLOATS * FLOAT_SIZE;
      const linkData = config.linkResults[t] ?? [];
      for (let i = 0; i < linkData.length; i++) {
        resultsDataView.setFloat32(
          linkDataOffset + i * FLOAT_SIZE,
          linkData[i],
          true,
        );
      }
    }
  }

  // Copy epilog to end of results.out
  resultsOutView.set(
    new Uint8Array(metadata, PROLOG_SIZE, EPILOG_SIZE),
    resultsOutSize - EPILOG_SIZE,
  );

  // Create tank volumes file
  let tankVolumesBuffer: ArrayBuffer | null = null;
  if (resAndTankCount > 0) {
    const volumesData = config.tankVolumes ?? [];
    tankVolumesBuffer = new ArrayBuffer(
      timestepCount * resAndTankCount * FLOAT_SIZE,
    );
    const volumesView = new DataView(tankVolumesBuffer);
    for (let t = 0; t < timestepCount; t++) {
      const volumes = volumesData[t] ?? new Array(resAndTankCount).fill(0);
      for (let i = 0; i < resAndTankCount; i++) {
        volumesView.setFloat32(
          (t * resAndTankCount + i) * FLOAT_SIZE,
          volumes[i] ?? 0,
          true,
        );
      }
    }
  }

  // Create simulation IDs - use numeric strings to match interface
  const nodeIds: string[] = [];
  const nodeIdToIndex = new Map<string, number>();
  for (let i = 0; i < nodeCount; i++) {
    const id = String(i + 1);
    nodeIds.push(id);
    nodeIdToIndex.set(id, i);
  }

  const linkIds: string[] = [];
  const linkIdToIndex = new Map<string, number>();
  for (let i = 0; i < linkCount; i++) {
    const id = String(i + 1);
    linkIds.push(id);
    linkIdToIndex.set(id, i);
  }

  const simulationIds: SimulationIds = {
    nodeIds,
    linkIds,
    nodeIdToIndex,
    linkIdToIndex,
  };

  return {
    metadata,
    resultsOut,
    tankVolumesBuffer,
    simulationIds,
  };
}

describe("EPSResultsReader (unit tests)", () => {
  beforeEach(() => {
    InMemoryStorage.resetAll();
  });

  describe("getTank level", () => {
    it("reads tank level from pressure value in results.out", async () => {
      // Setup: 3 nodes (1 junction + 1 reservoir + 1 tank), resAndTankCount=2
      // Tank is at index 2 (last node), which is index 1 in supply sources
      // For tanks, pressure equals the water level above base
      const nodeCount = 3;
      const resAndTankCount = 2;
      const expectedLevel = 15.5; // This is the pressure value for the tank

      // EPANET binary format: all demands, then all heads, then all pressures, then all qualities
      // [demand0, demand1, demand2, head0, head1, head2, pressure0, pressure1, pressure2, quality0, quality1, quality2]
      const fixture = createFixture({
        nodeCount,
        linkCount: 2,
        resAndTankCount,
        pumpCount: 0,
        timestepCount: 1,
        nodeResults: [
          // demands (3), heads (3), pressures (3), qualities (3)
          // Node 2 (tank) has pressure = expectedLevel
          [0, 0, 0, 100, 110, 115, 50, 60, expectedLevel, 0, 0, 0],
        ],
        tankVolumes: [[0, 1000]], // reservoir volume=0, tank volume=1000
      });

      const storage = new InMemoryStorage("test-tank-level-unit");
      await storage.save("results.out", fixture.resultsOut);
      await storage.save("tank-volumes.bin", fixture.tankVolumesBuffer!);

      const reader = new EPSResultsReader(storage);
      await reader.initialize(fixture.metadata, fixture.simulationIds);

      const resultsReader = await reader.getResultsForTimestep(0);
      // Tank is the last node (N3), which is at index 2
      const tank = resultsReader.getTank(IDS.TANK);

      expect(tank).not.toBeNull();
      expect(tank?.level).toBeCloseTo(expectedLevel, 5);
    });

    it("reads tank level across multiple timesteps", async () => {
      const nodeCount = 3;
      const resAndTankCount = 2;
      // Level values that change across timesteps (stored as pressure in results.out)
      const levels = [15.0, 18.5, 20.0];

      // EPANET binary format: all demands, then all heads, then all pressures, then all qualities
      const fixture = createFixture({
        nodeCount,
        linkCount: 2,
        resAndTankCount,
        pumpCount: 0,
        timestepCount: 3,
        nodeResults: [
          // Timestep 0: tank pressure (level) = 15.0
          [0, 0, 0, 100, 110, 115, 50, 60, levels[0], 0, 0, 0],
          // Timestep 1: tank pressure (level) = 18.5
          [0, 0, 0, 100, 110, 118.5, 50, 60, levels[1], 0, 0, 0],
          // Timestep 2: tank pressure (level) = 20.0
          [0, 0, 0, 100, 110, 120, 50, 60, levels[2], 0, 0, 0],
        ],
        tankVolumes: [
          [0, 1000],
          [0, 1100],
          [0, 1200],
        ],
      });

      const storage = new InMemoryStorage("test-tank-level-timesteps");
      await storage.save("results.out", fixture.resultsOut);
      await storage.save("tank-volumes.bin", fixture.tankVolumesBuffer!);

      const reader = new EPSResultsReader(storage);
      await reader.initialize(fixture.metadata, fixture.simulationIds);

      for (let t = 0; t < 3; t++) {
        const resultsReader = await reader.getResultsForTimestep(t);
        const tank = resultsReader.getTank(IDS.TANK);

        expect(tank).not.toBeNull();
        expect(tank?.level).toBeCloseTo(levels[t], 5);
      }
    });

    it("returns pressure and level as separate values", async () => {
      // This test verifies that both pressure and level are returned,
      // and that level equals pressure (for SI units)
      const nodeCount = 3;
      const resAndTankCount = 2;
      const pressureValue = 12.75;

      // EPANET binary format: all demands, then all heads, then all pressures, then all qualities
      const fixture = createFixture({
        nodeCount,
        linkCount: 2,
        resAndTankCount,
        pumpCount: 0,
        timestepCount: 1,
        nodeResults: [
          [0, 0, 0, 100, 110, 112.75, 50, 60, pressureValue, 0, 0, 0],
        ],
        tankVolumes: [[0, 500]],
      });

      const storage = new InMemoryStorage("test-tank-pressure-level");
      await storage.save("results.out", fixture.resultsOut);
      await storage.save("tank-volumes.bin", fixture.tankVolumesBuffer!);

      const reader = new EPSResultsReader(storage);
      await reader.initialize(fixture.metadata, fixture.simulationIds);

      const resultsReader = await reader.getResultsForTimestep(0);
      const tank = resultsReader.getTank(IDS.TANK);

      expect(tank).not.toBeNull();
      expect(tank?.pressure).toBeCloseTo(pressureValue, 5);
      expect(tank?.level).toBeCloseTo(pressureValue, 5);
      expect(tank?.level).toBe(tank?.pressure);
    });

    it("converts pressure to level in feet when using US units (psi)", async () => {
      const nodeCount = 3;
      const resAndTankCount = 2;
      const pressureInPsi = 6.5; // psi
      const expectedLevelInFeet = pressureInPsi / 0.4333; // 1 ft = 0.4333 psi

      // Use pressure units = 0 (psi)
      const fixture = createFixture({
        nodeCount,
        linkCount: 2,
        resAndTankCount,
        pumpCount: 0,
        timestepCount: 1,
        pressureUnits: 0, // psi
        nodeResults: [[0, 0, 0, 100, 110, 115, 50, 60, pressureInPsi, 0, 0, 0]],
        tankVolumes: [[0, 500]],
      });

      const storage = new InMemoryStorage("test-tank-psi-to-feet");
      await storage.save("results.out", fixture.resultsOut);
      await storage.save("tank-volumes.bin", fixture.tankVolumesBuffer!);

      const reader = new EPSResultsReader(storage);
      await reader.initialize(fixture.metadata, fixture.simulationIds);

      const resultsReader = await reader.getResultsForTimestep(0);
      const tank = resultsReader.getTank(IDS.TANK);

      expect(tank).not.toBeNull();
      expect(tank?.pressure).toBeCloseTo(pressureInPsi, 5);
      expect(tank?.level).toBeCloseTo(expectedLevelInFeet, 2);
    });
  });
});
