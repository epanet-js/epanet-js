import type { SerializedSeries } from "@epanet-js/ptsnet";
import type { AssetId, AssetType } from "src/hydraulic-model";
import type { UnitsSpec } from "src/lib/project-settings/quantities-spec";
import type { QualityAnalysisType } from "../epanet/simulation-metadata";
import type {
  TimeSeries,
  JunctionProperty,
  TankProperty,
  ReservoirProperty,
  PipeProperty,
  PumpProperty,
  ValveProperty,
} from "../epanet/eps-results-reader";
import type {
  ResultsReader,
  JunctionSimulation,
  TankSimulation,
  ReservoirSimulation,
  PipeSimulation,
  ValveSimulation,
  PumpSimulation,
  PumpEnergySummary,
  SimulationProperty,
} from "../results-reader";
import type { ResultsReaderSource } from "../results-reader-source";
import type { PtsnetWorkerResult } from "./worker";
import { siFlowTo, siHeadTo, siPressureTo, formatTransientTime } from "./units";

/**
 * Minimal read view over a ptsnet `SerializedSeries` (row-major matrix). Lets us
 * read transient results on the main thread without importing the ptsnet engine
 * (which pulls a Node-only `node:worker_threads` import into the browser bundle).
 */
class SeriesView {
  readonly labels: string[];
  private cols: number;
  private data: number[];
  private rowByLabel: Map<string, number>;

  constructor(series: SerializedSeries) {
    this.labels = series.labels;
    this.cols = series.cols;
    this.data = series.data;
    this.rowByLabel = new Map(series.labels.map((label, i) => [label, i]));
  }

  has(label: string): boolean {
    return this.rowByLabel.has(label);
  }

  at(label: string, t: number): number {
    const row = this.rowByLabel.get(label);
    if (row === undefined) return NaN;
    return this.data[row * this.cols + t];
  }

  get(label: string): Float64Array {
    const row = this.rowByLabel.get(label);
    const out = new Float64Array(this.cols);
    if (row === undefined) return out;
    const offset = row * this.cols;
    for (let t = 0; t < this.cols; t++) out[t] = this.data[offset + t];
    return out;
  }
}

/**
 * Reads ptsnet transient results through the same contract as the EPANET reader,
 * so the timeline, quick graph and map work unchanged. Results live in memory
 * (no OPFS). All ptsnet output is SI and converted to the project's units here.
 *
 * Asset ids map to ptsnet labels directly: the .inp is built with `labelIds:
 * false`, so every node/link label is `String(asset.id)`.
 */
export class TransientResultsReader implements ResultsReaderSource {
  readonly isTransient = true;
  readonly qualityType: QualityAnalysisType = "none";

  private head: SeriesView;
  private startFlow: SeriesView;
  private time: number[];
  private elevByLabel: Map<string, number>;
  private units: UnitsSpec;

  constructor(raw: PtsnetWorkerResult, units: UnitsSpec) {
    this.head = new SeriesView(raw.serialized.node.head);
    this.startFlow = new SeriesView(raw.serialized.pipeStart.flowrate);
    this.time = raw.serialized.time;
    this.units = units;
    this.elevByLabel = new Map(
      raw.nodeLabels.map((label, i) => [label, raw.nodeElevation[i]]),
    );
  }

  get timestepCount(): number {
    return this.time.length;
  }

  get reportingTimeStep(): number {
    return this.time.length > 1 ? this.time[1] - this.time[0] : 0;
  }

  formatTime(index: number): string {
    return formatTransientTime(this.time[index] ?? 0);
  }

  dispose(): Promise<void> {
    // Results are held in memory; nothing to free.
    return Promise.resolve();
  }

  getResultsForTimestep = (timestepIndex: number): Promise<ResultsReader> => {
    return Promise.resolve(
      new TransientTimestepReader(
        timestepIndex,
        this.head,
        this.startFlow,
        this.elevByLabel,
        this.units,
      ),
    );
  };

  private buildSeries(values: Float64Array): TimeSeries {
    return {
      values: Float32Array.from(values),
      intervalsCount: values.length,
      intervalSeconds: this.reportingTimeStep,
    };
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
  getTimeSeries(
    assetId: AssetId,
    assetType: AssetType,
    property: string,
  ): Promise<TimeSeries | null> {
    return Promise.resolve(this.timeSeriesFor(assetId, assetType, property));
  }

  private timeSeriesFor(
    assetId: AssetId,
    assetType: AssetType,
    property: string,
  ): TimeSeries | null {
    const label = String(assetId);

    if (
      assetType === "junction" ||
      assetType === "tank" ||
      assetType === "reservoir"
    ) {
      if (!this.head.has(label)) return null;
      const heads = this.head.get(label);
      if (property === "head") {
        return this.buildSeries(
          mapValues(heads, (m) => siHeadTo(m, this.units.head)),
        );
      }
      if (property === "pressure") {
        const elev = this.elevByLabel.get(label) ?? 0;
        return this.buildSeries(
          mapValues(heads, (m) => siPressureTo(m - elev, this.units.pressure)),
        );
      }
      return null;
    }

    if (assetType === "pipe" || assetType === "valve") {
      if (property !== "flow") return null;
      if (!this.startFlow.has(label)) return null;
      const flows = this.startFlow.get(label);
      return this.buildSeries(
        mapValues(flows, (q) => siFlowTo(q, this.units.flow)),
      );
    }

    return null;
  }
}

const mapValues = (
  source: Float64Array,
  convert: (value: number) => number,
): Float64Array => {
  const out = new Float64Array(source.length);
  for (let i = 0; i < source.length; i++) out[i] = convert(source[i]);
  return out;
};

/** A single transient timestep snapshot, used by the asset panel and map. */
class TransientTimestepReader implements ResultsReader {
  constructor(
    private t: number,
    private head: SeriesView,
    private startFlow: SeriesView,
    private elevByLabel: Map<string, number>,
    private units: UnitsSpec,
  ) {}

  private nodeHeadAndPressure(
    label: string,
  ): { head: number; pressure: number } | null {
    if (!this.head.has(label)) return null;
    const headM = this.head.at(label, this.t);
    const elev = this.elevByLabel.get(label) ?? 0;
    return {
      head: siHeadTo(headM, this.units.head),
      pressure: siPressureTo(headM - elev, this.units.pressure),
    };
  }

  private linkFlow(label: string): number | null {
    if (!this.startFlow.has(label)) return null;
    return siFlowTo(this.startFlow.at(label, this.t), this.units.flow);
  }

  getJunction = (junctionId: number): JunctionSimulation | null => {
    const values = this.nodeHeadAndPressure(String(junctionId));
    if (!values) return null;
    return {
      type: "junction",
      head: values.head,
      pressure: values.pressure,
      demand: 0,
      minPressure: values.pressure,
      maxPressure: values.pressure,
      waterAge: null,
      waterTrace: null,
      chemicalConcentration: null,
    };
  };

  getTank = (tankId: number): TankSimulation | null => {
    const values = this.nodeHeadAndPressure(String(tankId));
    if (!values) return null;
    return {
      type: "tank",
      head: values.head,
      pressure: values.pressure,
      netFlow: 0,
      level: 0,
      volume: 0,
      minPressure: values.pressure,
      maxPressure: values.pressure,
      waterAge: null,
      waterTrace: null,
      chemicalConcentration: null,
    };
  };

  getReservoir = (reservoirId: number): ReservoirSimulation | null => {
    const values = this.nodeHeadAndPressure(String(reservoirId));
    if (!values) return null;
    return {
      type: "reservoir",
      head: values.head,
      pressure: values.pressure,
      netFlow: 0,
      minPressure: values.pressure,
      maxPressure: values.pressure,
      waterAge: null,
      waterTrace: null,
      chemicalConcentration: null,
    };
  };

  getPipe = (pipeId: number): PipeSimulation | null => {
    const flow = this.linkFlow(String(pipeId));
    if (flow === null) return null;
    return {
      type: "pipe",
      flow,
      velocity: 0,
      headloss: 0,
      unitHeadloss: 0,
      status: "open",
      waterAge: null,
      waterTrace: null,
      chemicalConcentration: null,
    };
  };

  getValve = (_valveId: number): ValveSimulation | null => {
    // ptsnet flow lives on the adjacent pipes, not the valve label.
    return {
      type: "valve",
      flow: 0,
      velocity: 0,
      headloss: 0,
      status: "open",
      statusWarning: null,
      waterAge: null,
      waterTrace: null,
      chemicalConcentration: null,
    };
  };

  getPump = (_pumpId: number): PumpSimulation | null => null;

  getPumpEnergy = (_pumpId: number): PumpEnergySummary | null => null;

  getAllValues = (property: SimulationProperty): number[] => {
    if (property === "head") {
      return this.head.labels.map((label) =>
        siHeadTo(this.head.at(label, this.t), this.units.head),
      );
    }
    if (property === "pressure") {
      return this.head.labels.map((label) => {
        const elev = this.elevByLabel.get(label) ?? 0;
        return siPressureTo(
          this.head.at(label, this.t) - elev,
          this.units.pressure,
        );
      });
    }
    if (property === "flow") {
      return this.startFlow.labels.map((label) =>
        siFlowTo(this.startFlow.at(label, this.t), this.units.flow),
      );
    }
    return [];
  };
}
