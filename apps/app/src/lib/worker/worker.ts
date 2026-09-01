import { getIssues } from "@placemarkio/check-geojson";
import * as Comlink from "comlink";
import { EitherHandler } from "./shared";
import { bufferFeature } from "src/lib/buffer";
import {
  runSimulation,
  warmupSimulationEngine,
  configureWorkerReuse,
} from "src/simulation/epanet/worker";

export const lib = {
  getIssues,
  bufferFeature,
  runSimulation,
  warmupSimulationEngine,
  configureWorkerReuse,
};

export type Lib = typeof lib;

Comlink.transferHandlers.set("EITHER", EitherHandler);
Comlink.expose(lib);
