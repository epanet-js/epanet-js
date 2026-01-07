import {
  ResultsReader,
  PipeSimulation,
  ValveSimulation,
  PumpSimulation,
  JunctionSimulation,
  TankSimulation,
} from "../results-reader";
import { IPrivateAppStorage } from "src/infra/storage/private-app-storage";
import { RESULTS_OUT_KEY, TANK_VOLUMES_KEY, PUMP_STATUS_KEY } from "./worker";
import {
  SimulationMetadata,
  type SimulationIds,
  type PressureUnits,
  PROLOG_SIZE,
  EPILOG_SIZE,
} from "./simulation-metadata";
import { withDebugInstrumentation } from "src/infra/with-instrumentation";
import { captureError } from "src/infra/error-tracking";
import { AssetId, AssetType } from "src/hydraulic-model";

export type { SimulationIds } from "./simulation-metadata";

const ID_LENGTH = 32; // bytes per ID string
const FLOAT_SIZE = 4;

const NODE_RESULT_FLOATS = 4;
const LINK_RESULT_FLOATS = 8;
const PUMP_ENERGY_FLOATS = 7;

const PSI_PER_FOOT = 0.4333;

function pressureToLevel(
  pressure: number,
  pressureUnits: PressureUnits,
): number {
  if (pressureUnits === "psi") {
    return pressure / PSI_PER_FOOT;
  }
  return pressure;
}

export type JunctionProperty = "demand" | "head" | "pressure" | "quality";
export type TankProperty = "head" | "pressure" | "level" | "volume";
export type ReservoirProperty = "head";
export type PipeProperty = "flow" | "velocity" | "headloss" | "status";
export type PumpProperty = "flow" | "headloss" | "status";
export type ValveProperty = "flow" | "velocity" | "headloss" | "status";

type NodeProperty = "demand" | "head" | "pressure" | "quality";
type LinkProperty =
  | "flow"
  | "velocity"
  | "headloss"
  | "avgQuality"
  | "status"
  | "setting"
  | "reactionRate"
  | "friction";

const NODE_PROPERTY_INDEX: Record<NodeProperty, number> = {
  demand: 0,
  head: 1,
  pressure: 2,
  quality: 3,
};

const LINK_PROPERTY_INDEX: Record<LinkProperty, number> = {
  flow: 0,
  velocity: 1,
  headloss: 2,
  avgQuality: 3,
  status: 4,
  setting: 5,
  reactionRate: 6,
  friction: 7,
};

export interface TimeSeries {
  values: Float32Array;
  intervalsCount: number;
  intervalSeconds: number;
}

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
    return this.metadata.simulationMetadata.reportingStepsCount;
  }

  get reportingTimeStep(): number {
    if (!this.metadata) {
      throw new Error(
        "EPSResultsReader not initialized. Call initialize() first.",
      );
    }
    return this.metadata.simulationMetadata.reportingTimeStep;
  }

  getTimeSeries(
    assetId: AssetId,
    assetType: "junction",
    property: JunctionProperty,
  ): Promise<TimeSeries | null>;
  getTimeSeries(
    assetId: AssetId,
    assetType: "tank",
    property: TankProperty,
  ): Promise<TimeSeries | null>;
  getTimeSeries(
    assetId: AssetId,
    assetType: "reservoir",
    property: ReservoirProperty,
  ): Promise<TimeSeries | null>;
  getTimeSeries(
    assetId: AssetId,
    assetType: "pipe",
    property: PipeProperty,
  ): Promise<TimeSeries | null>;
  getTimeSeries(
    assetId: AssetId,
    assetType: "pump",
    property: PumpProperty,
  ): Promise<TimeSeries | null>;
  getTimeSeries(
    assetId: AssetId,
    assetType: "valve",
    property: ValveProperty,
  ): Promise<TimeSeries | null>;
  async getTimeSeries(
    assetId: AssetId,
    assetType: AssetType,
    property: string,
  ): Promise<TimeSeries | null> {
    if (!this.metadata) {
      throw new Error(
        "EPSResultsReader not initialized. Call initialize() first.",
      );
    }

    switch (assetType) {
      case "junction":
      case "reservoir":
        return this._getNodePropertyTimeSeries(
          assetId,
          property as NodeProperty,
        );
      case "tank":
        if (property === "volume")
          return this._getTankVolumeTimeSeries(assetId);
        if (property === "level") return this._getTankLevelTimeSeries(assetId);
        return this._getNodePropertyTimeSeries(
          assetId,
          property as NodeProperty,
        );
      case "pipe":
      case "valve":
        return this._getLinkPropertyTimeSeries(
          assetId,
          property as LinkProperty,
        );
      case "pump":
        if (property === "status")
          return this._getPumpStatusTimeSeries(assetId);
        return this._getLinkPropertyTimeSeries(
          assetId,
          property as LinkProperty,
        );
    }
  }

  private _buildTimeSeries(buffer: ArrayBuffer): TimeSeries {
    const { simulationMetadata } = this.metadata!;
    const values = new Float32Array(buffer);
    return {
      values,
      intervalsCount: values.length,
      intervalSeconds: simulationMetadata.reportingTimeStep,
    };
  }

  private async _getNodePropertyTimeSeries(
    nodeId: AssetId,
    property: NodeProperty,
  ): Promise<TimeSeries | null> {
    if (!this.metadata) return null;

    const nodeIndex = this.metadata.simulationIds.nodeIdToIndex.get(
      String(nodeId),
    );
    if (nodeIndex === undefined) return null;

    const { resultsBaseOffset, timestepBlockSize, simulationMetadata } =
      this.metadata;
    const propertyIndex = NODE_PROPERTY_INDEX[property];
    const { nodeCount } = simulationMetadata;

    const baseOffset =
      resultsBaseOffset +
      propertyIndex * nodeCount * FLOAT_SIZE +
      nodeIndex * FLOAT_SIZE;

    const values = await this.storage.readBlockSeries(
      RESULTS_OUT_KEY,
      baseOffset,
      FLOAT_SIZE,
      timestepBlockSize,
      simulationMetadata.reportingStepsCount,
    );
    return this._buildTimeSeries(values);
  }

  private async _getTankLevelTimeSeries(
    tankId: AssetId,
  ): Promise<TimeSeries | null> {
    const pressureSeries = await this._getNodePropertyTimeSeries(
      tankId,
      "pressure",
    );
    if (!pressureSeries) return null;

    const { pressureUnits } = this.metadata!.simulationMetadata;
    const levelValues = new Float32Array(pressureSeries.values.length);
    for (let i = 0; i < pressureSeries.values.length; i++) {
      levelValues[i] = pressureToLevel(pressureSeries.values[i], pressureUnits);
    }

    return {
      values: levelValues,
      intervalsCount: pressureSeries.intervalsCount,
      intervalSeconds: pressureSeries.intervalSeconds,
    };
  }

  private async _getLinkPropertyTimeSeries(
    linkId: AssetId,
    property: LinkProperty,
  ): Promise<TimeSeries | null> {
    if (!this.metadata) return null;

    const linkIndex = this.metadata.simulationIds.linkIdToIndex.get(
      String(linkId),
    );
    if (linkIndex === undefined) return null;

    const { resultsBaseOffset, timestepBlockSize, simulationMetadata } =
      this.metadata;
    const propertyIndex = LINK_PROPERTY_INDEX[property];
    const { nodeCount, linkCount } = simulationMetadata;

    const nodeDataSize = nodeCount * NODE_RESULT_FLOATS * FLOAT_SIZE;
    const baseOffset =
      resultsBaseOffset +
      nodeDataSize +
      propertyIndex * linkCount * FLOAT_SIZE +
      linkIndex * FLOAT_SIZE;

    const values = await this.storage.readBlockSeries(
      RESULTS_OUT_KEY,
      baseOffset,
      FLOAT_SIZE,
      timestepBlockSize,
      simulationMetadata.reportingStepsCount,
    );
    return this._buildTimeSeries(values);
  }

  private async _getTankVolumeTimeSeries(
    tankId: AssetId,
  ): Promise<TimeSeries | null> {
    if (!this.metadata) return null;

    const nodeIndex = this.metadata.simulationIds.nodeIdToIndex.get(
      String(tankId),
    );
    if (nodeIndex === undefined) return null;

    const { simulationMetadata } = this.metadata;
    const { resAndTankCount, nodeCount } = simulationMetadata;

    if (resAndTankCount === 0) return null;

    const firstSupplySourceIndex = nodeCount - resAndTankCount;
    if (nodeIndex < firstSupplySourceIndex) return null;

    const tankIndex = nodeIndex - firstSupplySourceIndex;
    const baseOffset = tankIndex * FLOAT_SIZE;
    const blockSize = resAndTankCount * FLOAT_SIZE;

    const values = await this.storage.readBlockSeries(
      TANK_VOLUMES_KEY,
      baseOffset,
      FLOAT_SIZE,
      blockSize,
      simulationMetadata.reportingStepsCount,
    );
    return this._buildTimeSeries(values);
  }

  private async _getPumpStatusTimeSeries(
    pumpId: AssetId,
  ): Promise<TimeSeries | null> {
    if (!this.metadata) return null;

    const linkIndex = this.metadata.simulationIds.linkIdToIndex.get(
      String(pumpId),
    );
    if (linkIndex === undefined) return null;

    const { simulationMetadata } = this.metadata;
    const { pumpCount } = simulationMetadata;

    if (pumpCount === 0) return null;

    const pumpPositionMap =
      await this.readPumpPositionMapFromFile(simulationMetadata);
    const pumpPosition = pumpPositionMap.get(linkIndex);
    if (pumpPosition === undefined) return null;

    const baseOffset = pumpPosition * FLOAT_SIZE;
    const blockSize = pumpCount * FLOAT_SIZE;

    const values = await this.storage.readBlockSeries(
      PUMP_STATUS_KEY,
      baseOffset,
      FLOAT_SIZE,
      blockSize,
      simulationMetadata.reportingStepsCount,
    );
    return this._buildTimeSeries(values);
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
        timestepIndex >= simulationMetadata.reportingStepsCount
      ) {
        captureError(
          new Error(
            `Timestep index ${timestepIndex} out of range [0, ${simulationMetadata.reportingStepsCount - 1}]`,
          ),
        );
        return new NullResultsReader();
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

      const pumpStatusForTimestep =
        await this.readPumpStatusForTimestep(timestepIndex);

      return new TimestepResultsReader(
        new DataView(timestepData),
        simulationMetadata,
        simulationIds,
        tankVolumesForTimestep,
        linkLengths,
        pumpStatusForTimestep,
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

    if (simMetadata.reportingStepsCount === 0) {
      return {
        simulationMetadata: simMetadata,
        simulationIds: {
          nodeIds: [],
          linkIds: [],
          nodeIdToIndex: new Map(),
          linkIdToIndex: new Map(),
        },
        linkLengths: new Float32Array(0),
        resultsBaseOffset: 0,
        timestepBlockSize: 0,
      };
    }

    const ids = simulationIds ?? (await this.readIdsFromFile(simMetadata));
    const linkLengths = await this.readLinkLengthsFromFile(simMetadata);

    const resultsBaseOffset =
      PROLOG_SIZE +
      ID_LENGTH * simMetadata.nodeCount +
      ID_LENGTH * simMetadata.linkCount +
      3 * FLOAT_SIZE * simMetadata.linkCount +
      2 * FLOAT_SIZE * simMetadata.resAndTankCount +
      FLOAT_SIZE * simMetadata.nodeCount +
      2 * FLOAT_SIZE * simMetadata.linkCount +
      PUMP_ENERGY_FLOATS * FLOAT_SIZE * simMetadata.pumpCount +
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
    try {
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
    } catch (error) {
      captureError(error as Error);
      return new SimulationMetadata(new ArrayBuffer(PROLOG_SIZE + EPILOG_SIZE));
    }
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
      3 * FLOAT_SIZE * simMetadata.linkCount +
      2 * FLOAT_SIZE * simMetadata.resAndTankCount +
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

  private async readPumpPositionMapFromFile(
    simMetadata: SimulationMetadata,
  ): Promise<Map<number, number>> {
    const map = new Map<number, number>();
    if (simMetadata.pumpCount === 0) return map;

    const pumpEnergyOffset =
      PROLOG_SIZE +
      ID_LENGTH * simMetadata.nodeCount +
      ID_LENGTH * simMetadata.linkCount +
      3 * FLOAT_SIZE * simMetadata.linkCount +
      2 * FLOAT_SIZE * simMetadata.resAndTankCount +
      FLOAT_SIZE * simMetadata.nodeCount +
      2 * FLOAT_SIZE * simMetadata.linkCount;

    const pumpEnergySize =
      PUMP_ENERGY_FLOATS * FLOAT_SIZE * simMetadata.pumpCount;

    const data = await this.storage.readSlice(
      RESULTS_OUT_KEY,
      pumpEnergyOffset,
      pumpEnergySize,
    );

    if (!data) {
      throw new Error("Failed to read pump energy data from results.out");
    }

    const dataView = new DataView(data);

    for (let position = 0; position < simMetadata.pumpCount; position++) {
      const byteOffset = position * PUMP_ENERGY_FLOATS * FLOAT_SIZE;
      const linkIndex1Based = dataView.getInt32(byteOffset, true);
      map.set(linkIndex1Based - 1, position);
    }

    return map;
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

  private async readPumpStatusForTimestep(
    timestepIndex: number,
  ): Promise<PumpStatusForTimestep | null> {
    const simMetadata = this.metadata!.simulationMetadata;
    if (simMetadata.pumpCount === 0) return null;

    const offset = timestepIndex * simMetadata.pumpCount * FLOAT_SIZE;
    const length = simMetadata.pumpCount * FLOAT_SIZE;

    const data = await this.storage.readSlice(PUMP_STATUS_KEY, offset, length);
    if (!data) return null;

    const pumpPositionByLinkIndex =
      await this.readPumpPositionMapFromFile(simMetadata);

    return {
      pumpPositionByLinkIndex,
      statuses: new Float32Array(data),
    };
  }
}

interface PumpStatusForTimestep {
  pumpPositionByLinkIndex: Map<number, number>;
  statuses: Float32Array;
}

class TimestepResultsReader implements ResultsReader {
  private view: DataView;
  private simulationMetadata: SimulationMetadata;
  private simulationIds: SimulationIds;
  private tankVolumes: Float32Array | null;
  private linkLengths: Float32Array;
  private pumpStatus: PumpStatusForTimestep | null;

  constructor(
    view: DataView,
    simulationMetadata: SimulationMetadata,
    simulationIds: SimulationIds,
    tankVolumes: Float32Array | null,
    linkLengths: Float32Array,
    pumpStatus: PumpStatusForTimestep | null,
  ) {
    this.view = view;
    this.simulationMetadata = simulationMetadata;
    this.simulationIds = simulationIds;
    this.tankVolumes = tankVolumes;
    this.linkLengths = linkLengths;
    this.pumpStatus = pumpStatus;
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

    const statusValue =
      this.getPumpStatusFromStorage(linkIndex) ?? linkData.status;
    const isOn = statusValue >= 3;

    return {
      type: "pump",
      flow: linkData.flow,
      headloss: linkData.headloss,
      status: isOn ? "on" : "off",
      statusWarning: this.mapPumpStatusWarning(statusValue),
    };
  }

  private getPumpStatusFromStorage(linkIndex: number): number | null {
    if (!this.pumpStatus) return null;

    const pumpPosition = this.pumpStatus.pumpPositionByLinkIndex.get(linkIndex);
    if (pumpPosition === undefined) return null;

    return this.pumpStatus.statuses[pumpPosition];
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
    const tankIndexInSupplySources =
      this.findTankIndexInSupplySources(nodeIndex);
    if (tankIndexInSupplySources !== -1) {
      if (this.tankVolumes) {
        volume = this.tankVolumes[tankIndexInSupplySources] ?? 0;
      }
    }

    const level = pressureToLevel(
      nodeData.pressure,
      this.simulationMetadata.pressureUnits,
    );

    return {
      type: "tank",
      pressure: nodeData.pressure,
      head: nodeData.head,
      level,
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

class NullResultsReader implements ResultsReader {
  getValve(): ValveSimulation | null {
    return null;
  }
  getPump(): PumpSimulation | null {
    return null;
  }
  getJunction(): JunctionSimulation | null {
    return null;
  }
  getPipe(): PipeSimulation | null {
    return null;
  }
  getTank(): TankSimulation | null {
    return null;
  }
}
