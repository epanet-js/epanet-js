import type { AssetId } from "src/hydraulic-model";
import type { ResultsReader } from "./results-reader";
import type {
  TimeSeries,
  JunctionProperty,
  TankProperty,
  ReservoirProperty,
  PipeProperty,
  PumpProperty,
  ValveProperty,
} from "./epanet/eps-results-reader";
import type { QualityAnalysisType } from "./epanet/simulation-metadata";

/**
 * The contract the whole app uses to read simulation results, regardless of the
 * engine that produced them. The EPANET extended-period reader
 * (`EPSResultsReader`) and the ptsnet transient reader (`TransientResultsReader`)
 * both implement this, so the timeline, quick graph, asset panel and map
 * symbology work the same way for either.
 *
 * `isTransient`/`formatTime` are optional hooks used only by the timeline to
 * render sub-second transient time labels.
 */
export interface ResultsReaderSource {
  readonly timestepCount: number;
  readonly reportingTimeStep: number;
  readonly qualityType: QualityAnalysisType;

  readonly isTransient?: boolean;
  formatTime?(index: number): string;

  getResultsForTimestep(timestepIndex: number): Promise<ResultsReader>;

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

  dispose(): Promise<void>;
}
