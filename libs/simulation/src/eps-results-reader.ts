import {
  ResultsReader,
  PipeSimulation,
  ValveSimulation,
  PumpSimulation,
  JunctionSimulation,
  TankSimulation,
  ReservoirSimulation,
  PumpEnergySummary,
  type SimulationProperty,
  pipeStatusOf,
  pumpStatusOf,
  pumpStatusWarningOf,
  valveStatusOf,
  valveStatusWarningOf,
} from "./results-reader";
import {
  IKeyBufferStore,
  ISyncKeyBufferReader,
  RESULTS_OUT_KEY,
  TANK_VOLUMES_KEY,
  PUMP_STATUS_KEY,
  NODE_STATS_KEY,
} from "./results-store";
import {
  SimulationMetadata,
  type SimulationIds,
  type PressureUnits,
  type QualityAnalysisType,
  PROLOG_SIZE,
  EPILOG_SIZE,
} from "./simulation-metadata";
import { Asset, AssetId, AssetType } from "@epanet-js/hydraulic-model";

export type { SimulationIds } from "./simulation-metadata";

export type ReadFailure = {
  as: string;
  ignore?: string[];
  contexts?: Record<string, Record<string, unknown>>;
};

export type ResultsErrorReporter = {
  readFailed: (error: unknown, failure: ReadFailure) => void;
  captureError: (error: Error) => void;
};

const errorName = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null || !("name" in error)) {
    return undefined;
  }
  const name = (error as { name: unknown }).name;
  return typeof name === "string" ? name : undefined;
};

const consoleReporter: ResultsErrorReporter = {
  readFailed: (error, { as, ignore = [] }) => {
    if (ignore.includes(errorName(error) ?? "")) return;
    // eslint-disable-next-line no-console
    console.error(as, error);
  },
  // eslint-disable-next-line no-console
  captureError: (error) => console.error(error),
};

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

export type JunctionProperty =
  | "demand"
  | "head"
  | "pressure"
  | "quality"
  | "waterAge"
  | "waterTrace"
  | "chemicalConcentration";
export type TankProperty =
  | "netFlow"
  | "head"
  | "pressure"
  | "level"
  | "volume"
  | "waterAge"
  | "waterTrace"
  | "chemicalConcentration";
export type ReservoirProperty =
  | "netFlow"
  | "head"
  | "pressure"
  | "waterAge"
  | "waterTrace"
  | "chemicalConcentration";
export type PipeProperty =
  | "flow"
  | "velocity"
  | "headloss"
  | "status"
  | "waterAge"
  | "waterTrace"
  | "chemicalConcentration";
export type PumpProperty =
  | "flow"
  | "head"
  | "status"
  | "setting"
  | "waterAge"
  | "waterTrace"
  | "chemicalConcentration";
export type ValveProperty =
  | "flow"
  | "velocity"
  | "headloss"
  | "status"
  | "setting"
  | "waterAge"
  | "waterTrace"
  | "chemicalConcentration";

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

// Maps property strings to binary node/link property indices.
// Properties not listed here (e.g. "level", "volume") need special handling
// and are not covered by the contiguous-read path.
const NODE_RESULTS_PROPERTY_INDEX: Partial<Record<string, number>> = {
  demand: NODE_PROPERTY_INDEX.demand,
  netFlow: NODE_PROPERTY_INDEX.demand,
  head: NODE_PROPERTY_INDEX.head,
  pressure: NODE_PROPERTY_INDEX.pressure,
  quality: NODE_PROPERTY_INDEX.quality,
  waterQuality: NODE_PROPERTY_INDEX.quality,
  waterAge: NODE_PROPERTY_INDEX.quality,
  waterTrace: NODE_PROPERTY_INDEX.quality,
  chemicalConcentration: NODE_PROPERTY_INDEX.quality,
};

const LINK_RESULTS_PROPERTY_INDEX: Partial<Record<string, number>> = {
  flow: LINK_PROPERTY_INDEX.flow,
  velocity: LINK_PROPERTY_INDEX.velocity,
  headloss: LINK_PROPERTY_INDEX.headloss,
  unitHeadloss: LINK_PROPERTY_INDEX.headloss,
  avgQuality: LINK_PROPERTY_INDEX.avgQuality,
  status: LINK_PROPERTY_INDEX.status,
  setting: LINK_PROPERTY_INDEX.setting,
  reactionRate: LINK_PROPERTY_INDEX.reactionRate,
  friction: LINK_PROPERTY_INDEX.friction,
  waterQuality: LINK_PROPERTY_INDEX.avgQuality,
  waterAge: LINK_PROPERTY_INDEX.avgQuality,
  waterTrace: LINK_PROPERTY_INDEX.avgQuality,
  chemicalConcentration: LINK_PROPERTY_INDEX.avgQuality,
};

export interface TimeSeries {
  values: Float32Array;
  intervalsCount: number;
  intervalSeconds: number;
}

type SyncKeyBufferStore = IKeyBufferStore & ISyncKeyBufferReader;

type Slice = { offset: number; length: number };

type SeriesRead = {
  key: string;
  baseOffset: number;
  blockSize: number;
  map: ((values: Float32Array) => Float32Array) | null;
};

interface CachedMetadata {
  simulationMetadata: SimulationMetadata;
  simulationIds: SimulationIds;
  linkLengths: Float32Array;
  resultsBaseOffset: number;
  timestepBlockSize: number;
}

export class EPSResultsReader<S extends IKeyBufferStore = IKeyBufferStore> {
  private storage: S;
  private metadata: CachedMetadata | null = null;
  private pumpPositionByLinkIndex: Map<number, number> = new Map();
  private pumpEnergy: Float32Array | null = null;
  private nodeMinHead: Float32Array | null = null;
  private nodeMaxHead: Float32Array | null = null;
  private nodeMinPressure: Float32Array | null = null;
  private nodeMaxPressure: Float32Array | null = null;
  // Diagnostic only: reported with read failures to tell a superseded run
  // (disposed, its directory deleted) apart from results vanishing under a
  // live one. Does not gate reads.
  private wasDisposed = false;

  constructor(
    storage: S,
    private readonly reporter: ResultsErrorReporter = consoleReporter,
  ) {
    this.storage = storage;
  }

  async initialize(
    epsMetadata?: ArrayBuffer,
    simulationIds?: SimulationIds,
  ): Promise<void> {
    this.metadata = await this.readMetadata(epsMetadata, simulationIds);
    const { pumpPositionByLinkIndex, pumpEnergy } =
      await this.readPumpEnergySection(this.metadata.simulationMetadata);
    this.pumpPositionByLinkIndex = pumpPositionByLinkIndex;
    this.pumpEnergy = pumpEnergy;
    await this.loadNodeStats(this.metadata.simulationMetadata.nodeCount);
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

  get qualityType(): QualityAnalysisType {
    if (!this.metadata) {
      throw new Error(
        "EPSResultsReader not initialized. Call initialize() first.",
      );
    }
    return this.metadata.simulationMetadata.qualityType;
  }

  getLinkLength(linkId: AssetId): number | null {
    if (!this.metadata) {
      throw new Error(
        "EPSResultsReader not initialized. Call initialize() first.",
      );
    }
    const linkIndex = this.metadata.simulationIds.linkIdToIndex.get(
      String(linkId),
    );
    if (linkIndex === undefined) return null;
    return this.metadata.linkLengths[linkIndex] ?? 0;
  }

  async dispose(): Promise<void> {
    this.wasDisposed = true;
    try {
      await this.storage.clearRun();
    } catch (error) {
      this.reporter.readFailed(error, {
        as: "epsResultsReader: dispose failed",
        ignore: ["NotFoundError"],
      });
    }
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

    try {
      const read = this.seriesReadOf(assetId, assetType, property);
      if (!read) return null;
      const series = this.storage
        .readBlockSeries(
          read.key,
          read.baseOffset,
          FLOAT_SIZE,
          read.blockSize,
          this.metadata.simulationMetadata.reportingStepsCount,
        )
        .then((values) => this.seriesFrom(read, values));
      return assetType === "pump" && property === "head"
        ? await series
        : series;
    } catch (error) {
      this.seriesReadFailed(error);
      return null;
    }
  }

  getTimeSeriesSync(
    this: EPSResultsReader<SyncKeyBufferStore>,
    assetId: AssetId,
    assetType: AssetType,
    property: string,
  ): TimeSeries | null {
    if (!this.metadata) {
      throw new Error(
        "EPSResultsReader not initialized. Call initialize() first.",
      );
    }

    try {
      const read = this.seriesReadOf(assetId, assetType, property);
      if (!read) return null;
      return this.seriesFrom(
        read,
        this.storage.readBlockSeriesSync(
          read.key,
          read.baseOffset,
          FLOAT_SIZE,
          read.blockSize,
          this.metadata.simulationMetadata.reportingStepsCount,
        ),
      );
    } catch (error) {
      this.seriesReadFailed(error);
      return null;
    }
  }

  private seriesReadFailed(error: unknown): void {
    this.reporter.readFailed(error, {
      as: "epsResultsReader: time series read failed",
      contexts: { "simulation results": { wasDisposed: this.wasDisposed } },
    });
  }

  private seriesReadOf(
    assetId: AssetId,
    assetType: AssetType,
    property: string,
  ): SeriesRead | null {
    switch (assetType) {
      case "junction":
        if (
          property === "waterAge" ||
          property === "waterTrace" ||
          property === "chemicalConcentration"
        )
          return this.nodePropertySeriesRead(assetId, "quality");
        return this.nodePropertySeriesRead(assetId, property as NodeProperty);
      case "reservoir":
        if (property === "netFlow")
          return this.nodePropertySeriesRead(assetId, "demand");
        if (
          property === "waterAge" ||
          property === "waterTrace" ||
          property === "chemicalConcentration"
        )
          return this.nodePropertySeriesRead(assetId, "quality");
        return this.nodePropertySeriesRead(assetId, property as NodeProperty);
      case "tank":
        if (property === "volume") return this.tankVolumeSeriesRead(assetId);
        if (property === "level") return this.tankLevelSeriesRead(assetId);
        if (property === "netFlow")
          return this.nodePropertySeriesRead(assetId, "demand");
        if (
          property === "waterAge" ||
          property === "waterTrace" ||
          property === "chemicalConcentration"
        )
          return this.nodePropertySeriesRead(assetId, "quality");
        return this.nodePropertySeriesRead(assetId, property as NodeProperty);
      case "pipe":
      case "valve":
        if (
          property === "waterAge" ||
          property === "waterTrace" ||
          property === "chemicalConcentration"
        )
          return this.linkPropertySeriesRead(assetId, "avgQuality");
        return this.linkPropertySeriesRead(assetId, property as LinkProperty);
      case "pump": {
        if (property === "status") return this.pumpStatusSeriesRead(assetId);
        if (
          property === "waterAge" ||
          property === "waterTrace" ||
          property === "chemicalConcentration"
        )
          return this.linkPropertySeriesRead(assetId, "avgQuality");
        if (property === "head") {
          const headloss = this.linkPropertySeriesRead(assetId, "headloss");
          return (
            headloss && {
              ...headloss,
              map: (values) => values.map((v) => -v),
            }
          );
        }
        return this.linkPropertySeriesRead(assetId, property as LinkProperty);
      }
    }
  }

  private async readPumpEnergySection(
    simMetadata: SimulationMetadata,
  ): Promise<{
    pumpPositionByLinkIndex: Map<number, number>;
    pumpEnergy: Float32Array | null;
  }> {
    const emptyResult = {
      pumpPositionByLinkIndex: new Map<number, number>(),
      pumpEnergy: null,
    };
    if (simMetadata.pumpCount === 0) return emptyResult;

    try {
      const pumpEnergyOffset = this.getPumpEnergyOffset(simMetadata);
      const pumpEnergySize =
        PUMP_ENERGY_FLOATS * FLOAT_SIZE * simMetadata.pumpCount;
      // Read all pump energy records + demand charge float in one slice
      const totalSize = pumpEnergySize + FLOAT_SIZE;

      const raw = await this.storage.readSlice(
        RESULTS_OUT_KEY,
        pumpEnergyOffset,
        totalSize,
      );

      const pumpEnergy = new Float32Array(raw);

      // Build position map: linkIndex (stored as int32 in float[0]) → position
      const pumpPositionByLinkIndex = new Map<number, number>();
      const view = new DataView(raw);
      for (let position = 0; position < simMetadata.pumpCount; position++) {
        const byteOffset = position * PUMP_ENERGY_FLOATS * FLOAT_SIZE;
        const linkIndex1Based = view.getInt32(byteOffset, true);
        pumpPositionByLinkIndex.set(linkIndex1Based - 1, position);
      }

      return { pumpPositionByLinkIndex, pumpEnergy };
    } catch (error) {
      this.reporter.readFailed(error, {
        as: "epsResultsReader: pump energy read failed",
      });
      return emptyResult;
    }
  }

  private getPumpEnergyOffset(simMetadata: SimulationMetadata): number {
    return (
      PROLOG_SIZE +
      ID_LENGTH * simMetadata.nodeCount +
      ID_LENGTH * simMetadata.linkCount +
      3 * FLOAT_SIZE * simMetadata.linkCount +
      2 * FLOAT_SIZE * simMetadata.resAndTankCount +
      FLOAT_SIZE * simMetadata.nodeCount +
      2 * FLOAT_SIZE * simMetadata.linkCount
    );
  }

  private async loadNodeStats(nodeCount: number): Promise<void> {
    try {
      const file = await this.storage.getFile(NODE_STATS_KEY);
      const blockBytes = nodeCount * FLOAT_SIZE;
      const [b0, b1, b2, b3] = await Promise.all([
        file.slice(0, blockBytes).arrayBuffer(),
        file.slice(blockBytes, blockBytes * 2).arrayBuffer(),
        file.slice(blockBytes * 2, blockBytes * 3).arrayBuffer(),
        file.slice(blockBytes * 3, blockBytes * 4).arrayBuffer(),
      ]);
      this.nodeMinHead = new Float32Array(b0);
      this.nodeMaxHead = new Float32Array(b1);
      this.nodeMinPressure = new Float32Array(b2);
      this.nodeMaxPressure = new Float32Array(b3);
    } catch {
      // File absent for old/single-step simulations — ranges stay null.
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

  private seriesFrom(read: SeriesRead, buffer: ArrayBuffer): TimeSeries {
    const series = this._buildTimeSeries(buffer);
    return read.map ? { ...series, values: read.map(series.values) } : series;
  }

  private nodePropertySeriesRead(
    nodeId: AssetId,
    property: NodeProperty,
  ): SeriesRead | null {
    if (!this.metadata) return null;

    const nodeIndex = this.metadata.simulationIds.nodeIdToIndex.get(
      String(nodeId),
    );
    if (nodeIndex === undefined) return null;

    const { resultsBaseOffset, timestepBlockSize, simulationMetadata } =
      this.metadata;
    const propertyIndex = NODE_PROPERTY_INDEX[property];
    const { nodeCount } = simulationMetadata;

    return {
      key: RESULTS_OUT_KEY,
      baseOffset:
        resultsBaseOffset +
        propertyIndex * nodeCount * FLOAT_SIZE +
        nodeIndex * FLOAT_SIZE,
      blockSize: timestepBlockSize,
      map: null,
    };
  }

  private tankLevelSeriesRead(tankId: AssetId): SeriesRead | null {
    const pressure = this.nodePropertySeriesRead(tankId, "pressure");
    if (!pressure) return null;

    const { pressureUnits } = this.metadata!.simulationMetadata;
    return {
      ...pressure,
      map: (values) => {
        const levelValues = new Float32Array(values.length);
        for (let i = 0; i < values.length; i++) {
          levelValues[i] = pressureToLevel(values[i], pressureUnits);
        }
        return levelValues;
      },
    };
  }

  private linkPropertySeriesRead(
    linkId: AssetId,
    property: LinkProperty,
  ): SeriesRead | null {
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
    return {
      key: RESULTS_OUT_KEY,
      baseOffset:
        resultsBaseOffset +
        nodeDataSize +
        propertyIndex * linkCount * FLOAT_SIZE +
        linkIndex * FLOAT_SIZE,
      blockSize: timestepBlockSize,
      map: null,
    };
  }

  private tankVolumeSeriesRead(tankId: AssetId): SeriesRead | null {
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
    return {
      key: TANK_VOLUMES_KEY,
      baseOffset: tankIndex * FLOAT_SIZE,
      blockSize: resAndTankCount * FLOAT_SIZE,
      map: null,
    };
  }

  private pumpStatusSeriesRead(pumpId: AssetId): SeriesRead | null {
    if (!this.metadata) return null;

    const linkIndex = this.metadata.simulationIds.linkIdToIndex.get(
      String(pumpId),
    );
    if (linkIndex === undefined) return null;

    const { simulationMetadata } = this.metadata;
    const { pumpCount } = simulationMetadata;

    if (pumpCount === 0) return null;

    const pumpPosition = this.pumpPositionByLinkIndex.get(linkIndex);
    if (pumpPosition === undefined) return null;

    return {
      key: PUMP_STATUS_KEY,
      baseOffset: pumpPosition * FLOAT_SIZE,
      blockSize: pumpCount * FLOAT_SIZE,
      map: null,
    };
  }

  getHeadRangesForNodes(nodeIds: AssetId[]): Array<[number, number]> {
    const empty = (): [number, number] => [Infinity, -Infinity];

    if (!this.metadata || nodeIds.length === 0) {
      return nodeIds.map(empty);
    }

    const { nodeMinHead, nodeMaxHead } = this;
    if (!nodeMinHead || !nodeMaxHead) return nodeIds.map(empty);

    const nodeIdToIndex = this.metadata.simulationIds.nodeIdToIndex;
    return nodeIds.map((nodeId) => {
      const nodeIndex = nodeIdToIndex.get(String(nodeId));
      if (nodeIndex === undefined) return empty();
      const min = nodeMinHead[nodeIndex];
      const max = nodeMaxHead[nodeIndex];
      if (min === undefined || max === undefined) return empty();
      return [min, max];
    });
  }

  async iterateTimeSeries<M extends string>(
    assets: Map<number, Asset>,
    properties: M[],
    onResult: (
      metric: M,
      asset: Asset,
      timeSeries: TimeSeries | null,
    ) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<void> {
    try {
      await this._iterateTimeSeries(assets, properties, onResult, signal);
    } catch (error) {
      // Cancellation must propagate; only OPFS-unavailable reads degrade.
      if (errorName(error) === "AbortError") throw error;
      this.reporter.readFailed(error, {
        as: "epsResultsReader: iterate time series read failed",
        contexts: { "simulation results": { wasDisposed: this.wasDisposed } },
      });
    }
  }

  private async _iterateTimeSeries<M extends string>(
    assets: Map<number, Asset>,
    properties: M[],
    onResult: (
      metric: M,
      asset: Asset,
      timeSeries: TimeSeries | null,
    ) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<void> {
    if (!this.metadata) return;

    const resultsFile = await this.storage.getFile(RESULTS_OUT_KEY);

    let pumpStatusFile: File | null = null;
    const { pumpCount } = this.metadata.simulationMetadata;
    if (pumpCount > 0) {
      try {
        pumpStatusFile = await this.storage.getFile(PUMP_STATUS_KEY);
      } catch {
        // Pump status file unavailable
      }
    }

    const {
      nodeCount,
      linkCount,
      reportingStepsCount: T,
    } = this.metadata.simulationMetadata;
    const { resultsBaseOffset, timestepBlockSize } = this.metadata;

    // Read the entire dynamic results section in one contiguous read.
    // readSize = blockSize = timestepBlockSize, so no striding waste.
    // For large simulations, _readBlockSeriesFromFile chunks at 64 MB.
    // Layout: [T0: node_demands×N, node_heads×N, ..., link_flows×L, ...], [T1: ...], ...
    const resultsRaw = await this._readBlockSeriesFromFile(
      resultsFile,
      resultsBaseOffset,
      timestepBlockSize,
      timestepBlockSize,
      T,
    );
    const resultsFloat = new Float32Array(resultsRaw);
    const timestepFloats = timestepBlockSize / FLOAT_SIZE;
    const nodeDataFloats = nodeCount * NODE_RESULT_FLOATS;

    // Read pump status contiguously (pumpCount floats per timestep, sequential)
    let pumpStatusFloat: Float32Array | null = null;
    if (
      pumpStatusFile &&
      pumpCount > 0 &&
      properties.some((p) => p === "status")
    ) {
      const raw = await pumpStatusFile
        .slice(0, pumpCount * T * FLOAT_SIZE)
        .arrayBuffer();
      pumpStatusFloat = new Float32Array(raw);
    }

    for (const property of properties) {
      const nodePropertyIdx = NODE_RESULTS_PROPERTY_INDEX[property];
      const linkPropertyIdx = LINK_RESULTS_PROPERTY_INDEX[property];

      for (const asset of assets.values()) {
        signal?.throwIfAborted();
        let timeSeries: TimeSeries | null = null;

        if (!asset.isLink) {
          if (nodePropertyIdx !== undefined) {
            const nodeIndex = this.metadata.simulationIds.nodeIdToIndex.get(
              String(asset.id),
            );
            if (nodeIndex !== undefined) {
              timeSeries = this._extractNodeTs(
                resultsFloat,
                nodePropertyIdx,
                nodeIndex,
                nodeCount,
                T,
                timestepFloats,
              );
            }
          }
        } else if (asset.type === "pump" && property === "status") {
          if (pumpStatusFloat) {
            const linkIndex = this.metadata.simulationIds.linkIdToIndex.get(
              String(asset.id),
            );
            if (linkIndex !== undefined) {
              const pumpPosition = this.pumpPositionByLinkIndex.get(linkIndex);
              if (pumpPosition !== undefined) {
                timeSeries = this._extractTs(
                  pumpStatusFloat,
                  pumpPosition,
                  pumpCount,
                  T,
                );
              }
            }
          }
        } else if (linkPropertyIdx !== undefined) {
          const linkIndex = this.metadata.simulationIds.linkIdToIndex.get(
            String(asset.id),
          );
          if (linkIndex !== undefined) {
            timeSeries = this._extractLinkTs(
              resultsFloat,
              linkPropertyIdx,
              linkIndex,
              linkCount,
              T,
              timestepFloats,
              nodeDataFloats,
            );
          }
        }

        await onResult(property, asset, timeSeries);
      }
    }
  }

  private _extractNodeTs(
    buffer: Float32Array,
    propertyIndex: number,
    nodeIndex: number,
    nodeCount: number,
    T: number,
    timestepFloats: number,
  ): TimeSeries {
    const values = new Float32Array(T);
    const base = propertyIndex * nodeCount + nodeIndex;
    for (let t = 0; t < T; t++) {
      values[t] = buffer[t * timestepFloats + base];
    }
    return this._buildTimeSeriesFromValues(values);
  }

  private _extractLinkTs(
    buf: Float32Array,
    propertyIndex: number,
    linkIndex: number,
    linkCount: number,
    T: number,
    timestepFloats: number,
    nodeDataFloats: number,
  ): TimeSeries {
    const values = new Float32Array(T);
    const base = nodeDataFloats + propertyIndex * linkCount + linkIndex;
    for (let t = 0; t < T; t++) {
      values[t] = buf[t * timestepFloats + base];
    }
    return this._buildTimeSeriesFromValues(values);
  }

  private _extractTs(
    buf: Float32Array,
    assetIndex: number,
    assetCount: number,
    T: number,
  ): TimeSeries {
    const values = new Float32Array(T);
    for (let t = 0; t < T; t++) {
      values[t] = buf[t * assetCount + assetIndex];
    }
    return this._buildTimeSeriesFromValues(values);
  }

  private _buildTimeSeriesFromValues(values: Float32Array): TimeSeries {
    return {
      values,
      intervalsCount: values.length,
      intervalSeconds: this.metadata!.simulationMetadata.reportingTimeStep,
    };
  }

  private async _getTimeSeriesFromFile(
    resultsFile: File,
    pumpStatusFile: File | null,
    assetId: AssetId,
    assetType: AssetType,
    property: string,
  ): Promise<TimeSeries | null> {
    switch (assetType) {
      case "junction":
      case "reservoir":
      case "tank":
        return this._getNodePropertyTimeSeriesFromFile(
          resultsFile,
          assetId,
          property as NodeProperty,
        );
      case "pipe":
      case "valve":
        return this._getLinkPropertyTimeSeriesFromFile(
          resultsFile,
          assetId,
          property as LinkProperty,
        );
      case "pump":
        if (property === "status") {
          return pumpStatusFile
            ? this._getPumpStatusTimeSeriesFromFile(pumpStatusFile, assetId)
            : null;
        }
        if (property === "head") {
          const headloss = await this._getLinkPropertyTimeSeriesFromFile(
            resultsFile,
            assetId,
            "headloss",
          );
          if (!headloss) return null;
          return { ...headloss, values: headloss.values.map((v) => -v) };
        }
        return this._getLinkPropertyTimeSeriesFromFile(
          resultsFile,
          assetId,
          property as LinkProperty,
        );
    }
  }

  private async _readBlockSeriesFromFile(
    file: File,
    baseOffset: number,
    readSize: number,
    blockSize: number,
    blockCount: number,
  ): Promise<ArrayBuffer> {
    if (blockCount === 0) return new ArrayBuffer(0);

    const MAX_BYTES_PER_CHUNK = 64 * 1024 * 1024;
    const maxBlocksPerChunk = Math.max(
      1,
      Math.floor(MAX_BYTES_PER_CHUNK / blockSize),
    );

    type Chunk = { firstBlock: number; blocksInChunk: number };
    const chunks: Chunk[] = [];
    for (
      let firstBlock = 0;
      firstBlock < blockCount;
      firstBlock += maxBlocksPerChunk
    ) {
      chunks.push({
        firstBlock,
        blocksInChunk: Math.min(maxBlocksPerChunk, blockCount - firstBlock),
      });
    }

    const chunkBuffers = await Promise.all(
      chunks.map(({ firstBlock, blocksInChunk }) => {
        const chunkOffset = baseOffset + firstBlock * blockSize;
        const chunkLength = (blocksInChunk - 1) * blockSize + readSize;
        return file.slice(chunkOffset, chunkOffset + chunkLength).arrayBuffer();
      }),
    );

    const result = new ArrayBuffer(readSize * blockCount);
    const dst = new Uint8Array(result);
    for (let c = 0; c < chunks.length; c++) {
      const { firstBlock, blocksInChunk } = chunks[c];
      const chunk = new Uint8Array(chunkBuffers[c]);
      for (let i = 0; i < blocksInChunk; i++) {
        dst.set(
          chunk.subarray(i * blockSize, i * blockSize + readSize),
          (firstBlock + i) * readSize,
        );
      }
    }

    return result;
  }

  private async _getNodePropertyTimeSeriesFromFile(
    file: File,
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

    const values = await this._readBlockSeriesFromFile(
      file,
      baseOffset,
      FLOAT_SIZE,
      timestepBlockSize,
      simulationMetadata.reportingStepsCount,
    );
    return this._buildTimeSeries(values);
  }

  private async _getLinkPropertyTimeSeriesFromFile(
    file: File,
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

    const values = await this._readBlockSeriesFromFile(
      file,
      baseOffset,
      FLOAT_SIZE,
      timestepBlockSize,
      simulationMetadata.reportingStepsCount,
    );
    return this._buildTimeSeries(values);
  }

  private async _getPumpStatusTimeSeriesFromFile(
    pumpStatusFile: File,
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

    const pumpPosition = this.pumpPositionByLinkIndex.get(linkIndex);
    if (pumpPosition === undefined) return null;

    const baseOffset = pumpPosition * FLOAT_SIZE;
    const blockSize = pumpCount * FLOAT_SIZE;

    const values = await this._readBlockSeriesFromFile(
      pumpStatusFile,
      baseOffset,
      FLOAT_SIZE,
      blockSize,
      simulationMetadata.reportingStepsCount,
    );
    return this._buildTimeSeries(values);
  }

  getResultsForTimestep = async (
    timestepIndex: number,
  ): Promise<ResultsReader> => {
    const { results, tankVolumes, pumpStatus } =
      this.timestepSlicesOf(timestepIndex);
    if (!results) return new NullResultsReader();

    try {
      const timestepData = await this.storage.readSlice(
        RESULTS_OUT_KEY,
        results.offset,
        results.length,
      );

      const tankVolumesForTimestep = await this.readOptionalSlice(
        TANK_VOLUMES_KEY,
        tankVolumes,
      );

      const pumpStatuses = await this.readOptionalSlice(
        PUMP_STATUS_KEY,
        pumpStatus,
      );

      return this.timestepReaderOf(
        timestepData,
        tankVolumesForTimestep,
        pumpStatuses,
      );
    } catch (error) {
      this.timestepReadFailed(error, timestepIndex);
      return new NullResultsReader();
    }
  };

  getResultsForTimestepSync(
    this: EPSResultsReader<SyncKeyBufferStore>,
    timestepIndex: number,
  ): ResultsReader {
    const { results, tankVolumes, pumpStatus } =
      this.timestepSlicesOf(timestepIndex);
    if (!results) return new NullResultsReader();

    try {
      const timestepData = this.storage.readSliceSync(
        RESULTS_OUT_KEY,
        results.offset,
        results.length,
      );
      return this.timestepReaderOf(
        timestepData,
        this.readOptionalSliceSync(TANK_VOLUMES_KEY, tankVolumes),
        this.readOptionalSliceSync(PUMP_STATUS_KEY, pumpStatus),
      );
    } catch (error) {
      this.timestepReadFailed(error, timestepIndex);
      return new NullResultsReader();
    }
  }

  private timestepSlicesOf(timestepIndex: number): {
    results: Slice | null;
    tankVolumes: Slice | null;
    pumpStatus: Slice | null;
  } {
    if (!this.metadata) {
      throw new Error(
        "EPSResultsReader not initialized. Call initialize() first.",
      );
    }

    const { simulationMetadata, resultsBaseOffset, timestepBlockSize } =
      this.metadata;

    if (
      timestepIndex < 0 ||
      timestepIndex >= simulationMetadata.reportingStepsCount
    ) {
      this.reporter.captureError(
        new Error(
          `Timestep index ${timestepIndex} out of range [0, ${simulationMetadata.reportingStepsCount - 1}]`,
        ),
      );
      return { results: null, tankVolumes: null, pumpStatus: null };
    }

    const { resAndTankCount, pumpCount } = simulationMetadata;
    return {
      results: {
        offset: resultsBaseOffset + timestepIndex * timestepBlockSize,
        length: timestepBlockSize,
      },
      tankVolumes:
        resAndTankCount === 0
          ? null
          : {
              offset: timestepIndex * resAndTankCount * FLOAT_SIZE,
              length: resAndTankCount * FLOAT_SIZE,
            },
      pumpStatus:
        pumpCount === 0
          ? null
          : {
              offset: timestepIndex * pumpCount * FLOAT_SIZE,
              length: pumpCount * FLOAT_SIZE,
            },
    };
  }

  private timestepReaderOf(
    timestepData: ArrayBuffer,
    tankVolumes: Float32Array | null,
    pumpStatuses: Float32Array | null,
  ): ResultsReader {
    const { simulationMetadata, simulationIds, linkLengths } = this.metadata!;
    return new TimestepResultsReader(
      new DataView(timestepData),
      simulationMetadata,
      simulationIds,
      tankVolumes,
      linkLengths,
      this.pumpPositionByLinkIndex,
      pumpStatuses,
      this.pumpEnergy,
      this.nodeMinPressure,
      this.nodeMaxPressure,
    );
  }

  private timestepReadFailed(error: unknown, timestepIndex: number): void {
    this.reporter.readFailed(error, {
      as: "epsResultsReader: timestep read failed",
      contexts: {
        "simulation results": {
          wasDisposed: this.wasDisposed,
          timestepIndex,
          reportingStepsCount:
            this.metadata!.simulationMetadata.reportingStepsCount,
        },
      },
    });
  }

  private static readonly EMPTY_METADATA: CachedMetadata = {
    simulationMetadata: new SimulationMetadata(
      new ArrayBuffer(PROLOG_SIZE + EPILOG_SIZE),
    ),
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

  private async readMetadata(
    rawMetadata?: ArrayBuffer,
    simulationIds?: SimulationIds,
  ): Promise<CachedMetadata> {
    try {
      const simMetadata = rawMetadata
        ? new SimulationMetadata(rawMetadata)
        : await this.readMetadataFromFile();

      if (simMetadata.reportingStepsCount === 0) {
        return EPSResultsReader.EMPTY_METADATA;
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
    } catch (error) {
      this.reporter.readFailed(error, {
        as: "epsResultsReader: metadata read failed",
      });
      return EPSResultsReader.EMPTY_METADATA;
    }
  }

  private async readMetadataFromFile(): Promise<SimulationMetadata> {
    const prologData = await this.storage.readSlice(
      RESULTS_OUT_KEY,
      0,
      PROLOG_SIZE,
    );
    const fileSize = await this.storage.getSize(RESULTS_OUT_KEY);

    const epilogData = await this.storage.readSlice(
      RESULTS_OUT_KEY,
      fileSize - EPILOG_SIZE,
      EPILOG_SIZE,
    );

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

    return new Float32Array(data);
  }

  private async readOptionalSlice(
    key: string,
    slice: Slice | null,
  ): Promise<Float32Array | null> {
    if (!slice) return null;
    try {
      const data = await this.storage.readSlice(
        key,
        slice.offset,
        slice.length,
      );
      return new Float32Array(data);
    } catch {
      return null;
    }
  }

  private readOptionalSliceSync(
    this: EPSResultsReader<SyncKeyBufferStore>,
    key: string,
    slice: Slice | null,
  ): Float32Array | null {
    if (!slice) return null;
    try {
      return new Float32Array(
        this.storage.readSliceSync(key, slice.offset, slice.length),
      );
    } catch {
      return null;
    }
  }
}

class TimestepResultsReader implements ResultsReader {
  private view: DataView;
  private simulationMetadata: SimulationMetadata;
  private simulationIds: SimulationIds;
  private tankVolumes: Float32Array | null;
  private linkLengths: Float32Array;
  private pumpPositionByLinkIndex: Map<number, number>;
  private pumpStatuses: Float32Array | null;
  private pumpEnergy: Float32Array | null;
  private nodeMinPressure: Float32Array | null;
  private nodeMaxPressure: Float32Array | null;

  constructor(
    view: DataView,
    simulationMetadata: SimulationMetadata,
    simulationIds: SimulationIds,
    tankVolumes: Float32Array | null,
    linkLengths: Float32Array,
    pumpPositionByLinkIndex: Map<number, number>,
    pumpStatuses: Float32Array | null,
    pumpEnergy: Float32Array | null,
    nodeMinPressure: Float32Array | null,
    nodeMaxPressure: Float32Array | null,
  ) {
    this.view = view;
    this.simulationMetadata = simulationMetadata;
    this.simulationIds = simulationIds;
    this.tankVolumes = tankVolumes;
    this.linkLengths = linkLengths;
    this.pumpPositionByLinkIndex = pumpPositionByLinkIndex;
    this.pumpStatuses = pumpStatuses;
    this.pumpEnergy = pumpEnergy;
    this.nodeMinPressure = nodeMinPressure;
    this.nodeMaxPressure = nodeMaxPressure;
  }

  getValve(valveId: number): ValveSimulation | null {
    const linkIndex = this.simulationIds.linkIdToIndex.get(String(valveId));
    if (linkIndex === undefined) return null;

    const linkData = this.getLinkData(linkIndex);
    const statusValue = linkData.status;

    const qualityType = this.simulationMetadata.qualityType;
    return {
      type: "valve",
      flow: linkData.flow,
      velocity: linkData.velocity,
      headloss: linkData.headloss,
      status: valveStatusOf(statusValue),
      statusWarning: valveStatusWarningOf(statusValue),
      waterAge: qualityType === "age" ? linkData.avgQuality : null,
      waterTrace: qualityType === "trace" ? linkData.avgQuality : null,
      chemicalConcentration:
        qualityType === "chemical" ? linkData.avgQuality : null,
    };
  }

  getPump(pumpId: number): PumpSimulation | null {
    const linkIndex = this.simulationIds.linkIdToIndex.get(String(pumpId));
    if (linkIndex === undefined) return null;

    const linkData = this.getLinkData(linkIndex);

    const statusValue =
      this.getPumpStatusFromStorage(linkIndex) ?? linkData.status;

    const qualityType = this.simulationMetadata.qualityType;
    return {
      type: "pump",
      flow: linkData.flow,
      head: -linkData.headloss,
      status: pumpStatusOf(statusValue),
      statusWarning: pumpStatusWarningOf(statusValue),
      waterAge: qualityType === "age" ? linkData.avgQuality : null,
      waterTrace: qualityType === "trace" ? linkData.avgQuality : null,
      chemicalConcentration:
        qualityType === "chemical" ? linkData.avgQuality : null,
    };
  }

  private getPumpStatusFromStorage(linkIndex: number): number | null {
    if (!this.pumpStatuses) return null;

    const pumpPosition = this.pumpPositionByLinkIndex.get(linkIndex);
    if (pumpPosition === undefined) return null;

    return this.pumpStatuses[pumpPosition];
  }

  getJunction(junctionId: number): JunctionSimulation | null {
    const nodeIndex = this.simulationIds.nodeIdToIndex.get(String(junctionId));
    if (nodeIndex === undefined) return null;

    const nodeData = this.getNodeData(nodeIndex);

    const qualityType = this.simulationMetadata.qualityType;
    return {
      type: "junction",
      pressure: nodeData.pressure,
      head: nodeData.head,
      demand: nodeData.demand,
      minPressure: this.nodeMinPressure?.[nodeIndex] ?? nodeData.pressure,
      maxPressure: this.nodeMaxPressure?.[nodeIndex] ?? nodeData.pressure,
      waterAge: qualityType === "age" ? nodeData.quality : null,
      waterTrace: qualityType === "trace" ? nodeData.quality : null,
      chemicalConcentration:
        qualityType === "chemical" ? nodeData.quality : null,
    };
  }

  getPipe(pipeId: number): PipeSimulation | null {
    const linkIndex = this.simulationIds.linkIdToIndex.get(String(pipeId));
    if (linkIndex === undefined) return null;

    const linkData = this.getLinkData(linkIndex);
    const length = this.linkLengths[linkIndex] ?? 0;

    const unitHeadloss = linkData.headloss;
    const headloss = unitHeadloss * (length / 1000);

    const qualityType = this.simulationMetadata.qualityType;
    return {
      type: "pipe",
      flow: linkData.flow,
      velocity: linkData.velocity,
      headloss,
      unitHeadloss,
      status: pipeStatusOf(linkData.status),
      waterAge: qualityType === "age" ? linkData.avgQuality : null,
      waterTrace: qualityType === "trace" ? linkData.avgQuality : null,
      chemicalConcentration:
        qualityType === "chemical" ? linkData.avgQuality : null,
    };
  }

  getTank(tankId: number): TankSimulation | null {
    const nodeIndex = this.simulationIds.nodeIdToIndex.get(String(tankId));
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

    const qualityType = this.simulationMetadata.qualityType;
    return {
      type: "tank",
      pressure: nodeData.pressure,
      head: nodeData.head,
      netFlow: nodeData.demand,
      level,
      volume,
      minPressure: this.nodeMinPressure?.[nodeIndex] ?? nodeData.pressure,
      maxPressure: this.nodeMaxPressure?.[nodeIndex] ?? nodeData.pressure,
      waterAge: qualityType === "age" ? nodeData.quality : null,
      waterTrace: qualityType === "trace" ? nodeData.quality : null,
      chemicalConcentration:
        qualityType === "chemical" ? nodeData.quality : null,
    };
  }

  getReservoir(reservoirId: number): ReservoirSimulation | null {
    const nodeIndex = this.simulationIds.nodeIdToIndex.get(String(reservoirId));
    if (nodeIndex === undefined) return null;

    const nodeData = this.getNodeData(nodeIndex);

    const qualityType = this.simulationMetadata.qualityType;
    return {
      type: "reservoir",
      pressure: nodeData.pressure,
      head: nodeData.head,
      netFlow: nodeData.demand,
      minPressure: this.nodeMinPressure?.[nodeIndex] ?? nodeData.pressure,
      maxPressure: this.nodeMaxPressure?.[nodeIndex] ?? nodeData.pressure,
      waterAge: qualityType === "age" ? nodeData.quality : null,
      waterTrace: qualityType === "trace" ? nodeData.quality : null,
      chemicalConcentration:
        qualityType === "chemical" ? nodeData.quality : null,
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

  private findTankIndexInSupplySources(nodeIndex: number): number {
    const firstSupplySourceIndex =
      this.simulationMetadata.nodeCount -
      this.simulationMetadata.resAndTankCount;
    if (nodeIndex >= firstSupplySourceIndex) {
      return nodeIndex - firstSupplySourceIndex;
    }
    return -1;
  }

  getAllValues(property: SimulationProperty): number[] {
    if (property === "minPressure")
      return this.nodeMinPressure ? Array.from(this.nodeMinPressure) : [];
    if (property === "maxPressure")
      return this.nodeMaxPressure ? Array.from(this.nodeMaxPressure) : [];

    const { nodeCount, linkCount } = this.simulationMetadata;

    const nodePropertyIndex: Partial<Record<SimulationProperty, number>> = {
      actualDemand: NODE_PROPERTY_INDEX.demand,
      head: NODE_PROPERTY_INDEX.head,
      pressure: NODE_PROPERTY_INDEX.pressure,
      waterAge: NODE_PROPERTY_INDEX.quality,
      waterTrace: NODE_PROPERTY_INDEX.quality,
      chemicalConcentration: NODE_PROPERTY_INDEX.quality,
    };

    const linkPropertyIndex: Partial<Record<SimulationProperty, number>> = {
      flow: LINK_PROPERTY_INDEX.flow,
      velocity: LINK_PROPERTY_INDEX.velocity,
      unitHeadloss: LINK_PROPERTY_INDEX.headloss,
    };

    const nodeIndex = nodePropertyIndex[property];
    if (nodeIndex !== undefined) {
      const offset = nodeCount * nodeIndex * FLOAT_SIZE;
      const values = new Array<number>(nodeCount);
      for (let i = 0; i < nodeCount; i++) {
        values[i] = this.view.getFloat32(offset + i * FLOAT_SIZE, true);
      }
      return values;
    }

    const linkIndex = linkPropertyIndex[property];
    if (linkIndex !== undefined) {
      const nodeDataSize = nodeCount * NODE_RESULT_FLOATS * FLOAT_SIZE;
      const offset = nodeDataSize + linkCount * linkIndex * FLOAT_SIZE;
      const values = new Array<number>(linkCount);
      for (let i = 0; i < linkCount; i++) {
        values[i] = this.view.getFloat32(offset + i * FLOAT_SIZE, true);
      }
      return values;
    }

    return [];
  }

  getPumpEnergy(pumpId: number): PumpEnergySummary | null {
    if (!this.pumpEnergy) return null;

    const linkIndex = this.simulationIds.linkIdToIndex.get(String(pumpId));
    if (linkIndex === undefined) return null;

    const position = this.pumpPositionByLinkIndex.get(linkIndex);
    if (position === undefined) return null;

    // Each pump record is PUMP_ENERGY_FLOATS (7) floats: [linkIndex, ...6 values]
    // Skip float[0] (linkIndex) by adding 1
    const offset = position * PUMP_ENERGY_FLOATS + 1;
    const v = this.pumpEnergy;

    // Demand charge is the float after all pump records
    const demandChargeIndex =
      this.simulationMetadata.pumpCount * PUMP_ENERGY_FLOATS;

    return {
      utilization: v[offset],
      averageEfficiency: v[offset + 1],
      averageKwPerFlowUnit: v[offset + 2],
      averageKw: v[offset + 3],
      peakKw: v[offset + 4],
      averageCostPerDay: v[offset + 5],
      demandCharge: v[demandChargeIndex],
    };
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
  getReservoir(): ReservoirSimulation | null {
    return null;
  }
  getAllValues(): number[] {
    return [];
  }
  getPumpEnergy(): PumpEnergySummary | null {
    return null;
  }
}
