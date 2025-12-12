import {
  ResultsReader,
  PipeSimulation,
  ValveSimulation,
  PumpSimulation,
  JunctionSimulation,
  TankSimulation,
} from "../results-reader";
import { IPrivateAppStorage } from "src/infra/storage/private-app-storage";
import { RESULTS_OUT_KEY, TANK_VOLUMES_KEY } from "./worker-eps";
import {
  SimulationMetadata,
  type SimulationIds,
  PROLOG_SIZE,
  EPILOG_SIZE,
} from "./simulation-metadata";
import { withDebugInstrumentation } from "src/infra/with-instrumentation";

export type { SimulationIds } from "./simulation-metadata";

const ID_LENGTH = 32; // bytes per ID string
const FLOAT_SIZE = 4;

// Node result: demand, head, pressure, quality (4 floats)
const NODE_RESULT_FLOATS = 4;
// Link result: flow, velocity, headloss, avgQuality, status, setting, reactionRate, friction (8 floats)
const LINK_RESULT_FLOATS = 8;

interface CachedMetadata {
  simulationMetadata: SimulationMetadata;
  simulationIds: SimulationIds;
  linkLengths: Float32Array;
  resultsBaseOffset: number;
  timestepBlockSize: number;
}

export class EPSResultsReader {
  private storage: IPrivateAppStorage;
  private metadata: CachedMetadata | null = null;

  constructor(storage: IPrivateAppStorage) {
    this.storage = storage;
  }

  async initialize(
    epsMetadata?: ArrayBuffer,
    simulationIds?: SimulationIds,
  ): Promise<void> {
    this.metadata = await this.readMetadata(epsMetadata, simulationIds);
  }

  get simulationIds(): SimulationIds {
    if (!this.metadata) {
      throw new Error(
        "EPSResultsReader not initialized. Call initialize() first.",
      );
    }
    return this.metadata.simulationIds;
  }

  get timestepCount(): number {
    if (!this.metadata) {
      throw new Error(
        "EPSResultsReader not initialized. Call initialize() first.",
      );
    }
    return this.metadata.simulationMetadata.reportingPeriods;
  }

  getResultsForTimestep = withDebugInstrumentation(
    async (timestepIndex: number): Promise<ResultsReader> => {
      if (!this.metadata) {
        throw new Error(
          "EPSResultsReader not initialized. Call initialize() first.",
        );
      }

      const {
        simulationMetadata,
        simulationIds,
        linkLengths,
        resultsBaseOffset,
        timestepBlockSize,
      } = this.metadata;

      if (
        timestepIndex < 0 ||
        timestepIndex >= simulationMetadata.reportingPeriods
      ) {
        throw new Error(
          `Timestep index ${timestepIndex} out of range [0, ${simulationMetadata.reportingPeriods - 1}]`,
        );
      }

      const timestepOffset =
        resultsBaseOffset + timestepIndex * timestepBlockSize;
      const timestepData = await this.storage.readSlice(
        RESULTS_OUT_KEY,
        timestepOffset,
        timestepBlockSize,
      );

      if (!timestepData) {
        throw new Error(
          `Failed to read timestep ${timestepIndex} data from storage`,
        );
      }

      const tankVolumesForTimestep =
        await this.readTankVolumesForTimestep(timestepIndex);

      return new TimestepResultsReader(
        new DataView(timestepData),
        simulationMetadata,
        simulationIds,
        tankVolumesForTimestep,
        linkLengths,
      );
    },
    { name: "SIMULATION:FETCH_STEP_FROM_STORAGE", maxDurationMs: 100 },
  );

  private async readMetadata(
    rawMetadata?: ArrayBuffer,
    simulationIds?: SimulationIds,
  ): Promise<CachedMetadata> {
    const simMetadata = rawMetadata
      ? new SimulationMetadata(rawMetadata)
      : await this.readMetadataFromFile();

    const ids = simulationIds ?? (await this.readIdsFromFile(simMetadata));
    const linkLengths = await this.readLinkLengthsFromFile(simMetadata);

    // Binary format order (after 884-byte prolog):
    // 1. Node IDs (32 × Nnodes)
    // 2. Link IDs (32 × Nlinks)
    // 3. Head node indices (4 × Nlinks)
    // 4. Tail node indices (4 × Nlinks)
    // 5. Link types (4 × Nlinks)
    // 6. Tank node indices (4 × Ntanks)
    // 7. Tank surface areas (4 × Ntanks)
    // 8. Node elevations (4 × Nnodes)
    // 9. Link lengths (4 × Nlinks)
    // 10. Link diameters (4 × Nlinks)
    // 11. Pump energy data (7 floats × Npumps)
    // 12. Peak energy usage (1 float)
    // Then dynamic results begin
    const resultsBaseOffset =
      PROLOG_SIZE +
      ID_LENGTH * simMetadata.nodeCount +
      ID_LENGTH * simMetadata.linkCount +
      FLOAT_SIZE * simMetadata.linkCount +
      FLOAT_SIZE * simMetadata.linkCount +
      FLOAT_SIZE * simMetadata.linkCount +
      FLOAT_SIZE * simMetadata.resAndTankCount +
      FLOAT_SIZE * simMetadata.resAndTankCount +
      FLOAT_SIZE * simMetadata.nodeCount +
      FLOAT_SIZE * simMetadata.linkCount +
      FLOAT_SIZE * simMetadata.linkCount +
      28 * simMetadata.pumpCount +
      4;

    const timestepBlockSize =
      simMetadata.nodeCount * NODE_RESULT_FLOATS * FLOAT_SIZE +
      simMetadata.linkCount * LINK_RESULT_FLOATS * FLOAT_SIZE;

    return {
      simulationMetadata: simMetadata,
      simulationIds: ids,
      linkLengths,
      resultsBaseOffset,
      timestepBlockSize,
    };
  }

  private async readMetadataFromFile(): Promise<SimulationMetadata> {
    const prologData = await this.storage.readSlice(
      RESULTS_OUT_KEY,
      0,
      PROLOG_SIZE,
    );
    if (!prologData) {
      throw new Error("Failed to read prolog from results.out");
    }

    const fileSize = await this.storage.getSize(RESULTS_OUT_KEY);
    if (!fileSize) {
      throw new Error("Failed to get size of results.out");
    }

    const epilogData = await this.storage.readSlice(
      RESULTS_OUT_KEY,
      fileSize - EPILOG_SIZE,
      EPILOG_SIZE,
    );
    if (!epilogData) {
      throw new Error("Failed to read epilog from results.out");
    }

    const prologAndEpilog = new ArrayBuffer(PROLOG_SIZE + EPILOG_SIZE);
    const view = new Uint8Array(prologAndEpilog);
    view.set(new Uint8Array(prologData), 0);
    view.set(new Uint8Array(epilogData), PROLOG_SIZE);

    return new SimulationMetadata(prologAndEpilog);
  }

  private async readIdsFromFile(
    simMetadata: SimulationMetadata,
  ): Promise<SimulationIds> {
    const nodeIdsOffset = PROLOG_SIZE;
    const nodeIdsLength = simMetadata.nodeCount * ID_LENGTH;
    const linkIdsOffset = nodeIdsOffset + nodeIdsLength;
    const linkIdsLength = simMetadata.linkCount * ID_LENGTH;

    const nodeIdsData = await this.storage.readSlice(
      RESULTS_OUT_KEY,
      nodeIdsOffset,
      nodeIdsLength,
    );
    const linkIdsData = await this.storage.readSlice(
      RESULTS_OUT_KEY,
      linkIdsOffset,
      linkIdsLength,
    );

    if (!nodeIdsData || !linkIdsData) {
      throw new Error("Failed to read ID sections from results.out");
    }

    return this.parseIds(nodeIdsData, linkIdsData, simMetadata);
  }

  private parseIds(
    nodeIdsData: ArrayBuffer,
    linkIdsData: ArrayBuffer,
    simMetadata: SimulationMetadata,
  ): SimulationIds {
    const decoder = new TextDecoder("utf-8");

    const nodeIds: string[] = [];
    const nodeIdToIndex = new Map<string, number>();
    const nodeView = new Uint8Array(nodeIdsData);

    for (let i = 0; i < simMetadata.nodeCount; i++) {
      const start = i * ID_LENGTH;
      const idBytes = nodeView.slice(start, start + ID_LENGTH);
      let end = idBytes.indexOf(0);
      if (end === -1) end = ID_LENGTH;
      const id = decoder.decode(idBytes.slice(0, end)).trim();
      nodeIds.push(id);
      nodeIdToIndex.set(id, i);
    }

    const linkIds: string[] = [];
    const linkIdToIndex = new Map<string, number>();
    const linkView = new Uint8Array(linkIdsData);

    for (let i = 0; i < simMetadata.linkCount; i++) {
      const start = i * ID_LENGTH;
      const idBytes = linkView.slice(start, start + ID_LENGTH);
      let end = idBytes.indexOf(0);
      if (end === -1) end = ID_LENGTH;
      const id = decoder.decode(idBytes.slice(0, end)).trim();
      linkIds.push(id);
      linkIdToIndex.set(id, i);
    }

    return { nodeIds, linkIds, nodeIdToIndex, linkIdToIndex };
  }

  private async readLinkLengthsFromFile(
    simMetadata: SimulationMetadata,
  ): Promise<Float32Array> {
    const linkLengthOffset =
      PROLOG_SIZE +
      ID_LENGTH * simMetadata.nodeCount +
      ID_LENGTH * simMetadata.linkCount +
      FLOAT_SIZE * simMetadata.linkCount +
      FLOAT_SIZE * simMetadata.linkCount +
      FLOAT_SIZE * simMetadata.linkCount +
      FLOAT_SIZE * simMetadata.resAndTankCount +
      FLOAT_SIZE * simMetadata.resAndTankCount +
      FLOAT_SIZE * simMetadata.nodeCount;

    const linkLengthSize = simMetadata.linkCount * FLOAT_SIZE;

    const data = await this.storage.readSlice(
      RESULTS_OUT_KEY,
      linkLengthOffset,
      linkLengthSize,
    );

    if (!data) {
      throw new Error("Failed to read link lengths from results.out");
    }

    return new Float32Array(data);
  }

  private async readTankVolumesForTimestep(
    timestepIndex: number,
  ): Promise<Float32Array | null> {
    const resAndTankCount = this.metadata!.simulationMetadata.resAndTankCount;
    if (resAndTankCount === 0) return null;

    const offset = timestepIndex * resAndTankCount * FLOAT_SIZE;
    const length = resAndTankCount * FLOAT_SIZE;

    const data = await this.storage.readSlice(TANK_VOLUMES_KEY, offset, length);
    if (!data) return null;

    return new Float32Array(data);
  }
}

class TimestepResultsReader implements ResultsReader {
  private view: DataView;
  private simulationMetadata: SimulationMetadata;
  private simulationIds: SimulationIds;
  private tankVolumes: Float32Array | null;
  private linkLengths: Float32Array;

  constructor(
    view: DataView,
    simulationMetadata: SimulationMetadata,
    simulationIds: SimulationIds,
    tankVolumes: Float32Array | null,
    linkLengths: Float32Array,
  ) {
    this.view = view;
    this.simulationMetadata = simulationMetadata;
    this.simulationIds = simulationIds;
    this.tankVolumes = tankVolumes;
    this.linkLengths = linkLengths;
  }

  getValve(valveId: string): ValveSimulation | null {
    const linkIndex = this.simulationIds.linkIdToIndex.get(valveId);
    if (linkIndex === undefined) return null;

    const linkData = this.getLinkData(linkIndex);
    const statusValue = linkData.status;

    return {
      type: "valve",
      flow: linkData.flow,
      velocity: linkData.velocity,
      headloss: linkData.headloss,
      status: this.mapValveStatus(statusValue),
      statusWarning: this.mapValveStatusWarning(statusValue),
    };
  }

  getPump(pumpId: string): PumpSimulation | null {
    const linkIndex = this.simulationIds.linkIdToIndex.get(pumpId);
    if (linkIndex === undefined) return null;

    const linkData = this.getLinkData(linkIndex);
    const statusValue = linkData.status;
    const isOn = statusValue >= 3;

    return {
      type: "pump",
      flow: linkData.flow,
      headloss: linkData.headloss,
      status: isOn ? "on" : "off",
      statusWarning: this.mapPumpStatusWarning(statusValue),
    };
  }

  getJunction(junctionId: string): JunctionSimulation | null {
    const nodeIndex = this.simulationIds.nodeIdToIndex.get(junctionId);
    if (nodeIndex === undefined) return null;

    const nodeData = this.getNodeData(nodeIndex);

    return {
      type: "junction",
      pressure: nodeData.pressure,
      head: nodeData.head,
      demand: nodeData.demand,
    };
  }

  getPipe(pipeId: string): PipeSimulation | null {
    const linkIndex = this.simulationIds.linkIdToIndex.get(pipeId);
    if (linkIndex === undefined) return null;

    const linkData = this.getLinkData(linkIndex);
    const length = this.linkLengths[linkIndex] ?? 0;

    const unitHeadloss = linkData.headloss;
    const headloss = unitHeadloss * (length / 1000);

    return {
      type: "pipe",
      flow: linkData.flow,
      velocity: linkData.velocity,
      headloss,
      unitHeadloss,
      status: this.mapPipeStatus(linkData.status),
    };
  }

  getTank(tankId: string): TankSimulation | null {
    const nodeIndex = this.simulationIds.nodeIdToIndex.get(tankId);
    if (nodeIndex === undefined) return null;

    const nodeData = this.getNodeData(nodeIndex);

    let volume = 0;
    if (this.tankVolumes) {
      const tankIndexInSupplySources =
        this.findTankIndexInSupplySources(nodeIndex);
      if (tankIndexInSupplySources !== -1) {
        volume = this.tankVolumes[tankIndexInSupplySources] ?? 0;
      }
    }

    return {
      type: "tank",
      pressure: nodeData.pressure,
      head: nodeData.head,
      level: nodeData.pressure,
      volume,
    };
  }

  private getNodeData(nodeIndex: number): {
    demand: number;
    head: number;
    pressure: number;
    quality: number;
  } {
    const { nodeCount } = this.simulationMetadata;
    const demandOffset = nodeIndex * FLOAT_SIZE;
    const headOffset = nodeCount * FLOAT_SIZE + nodeIndex * FLOAT_SIZE;
    const pressureOffset = nodeCount * 2 * FLOAT_SIZE + nodeIndex * FLOAT_SIZE;
    const qualityOffset = nodeCount * 3 * FLOAT_SIZE + nodeIndex * FLOAT_SIZE;

    return {
      demand: this.view.getFloat32(demandOffset, true),
      head: this.view.getFloat32(headOffset, true),
      pressure: this.view.getFloat32(pressureOffset, true),
      quality: this.view.getFloat32(qualityOffset, true),
    };
  }

  private getLinkData(linkIndex: number): {
    flow: number;
    velocity: number;
    headloss: number;
    avgQuality: number;
    status: number;
    setting: number;
    reactionRate: number;
    friction: number;
  } {
    const { nodeCount, linkCount } = this.simulationMetadata;
    const nodeDataSize = nodeCount * NODE_RESULT_FLOATS * FLOAT_SIZE;

    const flowOffset = nodeDataSize + linkIndex * FLOAT_SIZE;
    const velocityOffset =
      nodeDataSize + linkCount * FLOAT_SIZE + linkIndex * FLOAT_SIZE;
    const headlossOffset =
      nodeDataSize + linkCount * 2 * FLOAT_SIZE + linkIndex * FLOAT_SIZE;
    const avgQualityOffset =
      nodeDataSize + linkCount * 3 * FLOAT_SIZE + linkIndex * FLOAT_SIZE;
    const statusOffset =
      nodeDataSize + linkCount * 4 * FLOAT_SIZE + linkIndex * FLOAT_SIZE;
    const settingOffset =
      nodeDataSize + linkCount * 5 * FLOAT_SIZE + linkIndex * FLOAT_SIZE;
    const reactionOffset =
      nodeDataSize + linkCount * 6 * FLOAT_SIZE + linkIndex * FLOAT_SIZE;
    const frictionOffset =
      nodeDataSize + linkCount * 7 * FLOAT_SIZE + linkIndex * FLOAT_SIZE;

    return {
      flow: this.view.getFloat32(flowOffset, true),
      velocity: this.view.getFloat32(velocityOffset, true),
      headloss: this.view.getFloat32(headlossOffset, true),
      avgQuality: this.view.getFloat32(avgQualityOffset, true),
      status: this.view.getFloat32(statusOffset, true),
      setting: this.view.getFloat32(settingOffset, true),
      reactionRate: this.view.getFloat32(reactionOffset, true),
      friction: this.view.getFloat32(frictionOffset, true),
    };
  }

  private mapValveStatus(statusValue: number): "active" | "open" | "closed" {
    if (statusValue < 3) return "closed";
    if (statusValue === 4) return "active";
    return "open";
  }

  private mapValveStatusWarning(
    statusValue: number,
  ): ValveSimulation["statusWarning"] {
    if (statusValue === 6) return "cannot-deliver-flow";
    if (statusValue === 7) return "cannot-deliver-pressure";
    return null;
  }

  private mapPipeStatus(statusValue: number): "open" | "closed" {
    if (statusValue < 3) return "closed";
    return "open";
  }

  private mapPumpStatusWarning(
    statusValue: number,
  ): PumpSimulation["statusWarning"] {
    if (statusValue === 0) return "cannot-deliver-head";
    if (statusValue === 5) return "cannot-deliver-flow";
    return null;
  }

  private findTankIndexInSupplySources(nodeIndex: number): number {
    const firstSupplySourceIndex =
      this.simulationMetadata.nodeCount -
      this.simulationMetadata.resAndTankCount;
    if (nodeIndex >= firstSupplySourceIndex) {
      return nodeIndex - firstSupplySourceIndex;
    }
    return -1;
  }
}
