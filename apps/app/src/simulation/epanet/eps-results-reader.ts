import {
  EPSResultsReader as BaseEPSResultsReader,
  type IKeyBufferStore,
  type ResultsErrorReporter,
} from "@epanet-js/simulation";
import { opfsUnavailableErrors } from "src/infra/storage";
import { withDebugInstrumentation } from "src/infra/with-instrumentation";
import { captureError } from "src/infra/error-tracking";
import { handleError } from "src/infra/errors";

export type {
  SimulationIds,
  TimeSeries,
  JunctionProperty,
  TankProperty,
  ReservoirProperty,
  PipeProperty,
  PumpProperty,
  ValveProperty,
} from "@epanet-js/simulation";

const appReporter: ResultsErrorReporter = {
  readFailed: (error, { as, ignore, contexts }) =>
    handleError(error, {
      as,
      ignore,
      warn: opfsUnavailableErrors,
      onUnexpected: "capture",
      contexts,
    }),
  captureError: (error) => captureError(error),
};

export class EPSResultsReader extends BaseEPSResultsReader {
  constructor(storage: IKeyBufferStore) {
    super(storage, appReporter);
    this.getResultsForTimestep = withDebugInstrumentation(
      this.getResultsForTimestep,
      { name: "SIMULATION:FETCH_STEP_FROM_STORAGE", maxDurationMs: 100 },
    );
  }
}
