import { getIssues } from "@placemarkio/check-geojson";
import * as Comlink from "comlink";
import { EitherHandler } from "./shared";
import { bufferFeature } from "src/lib/buffer";
import {
  runSimulation,
  warmupSimulationEngine,
} from "src/simulation/epanet/worker";

export const lib = {
  getIssues,
  bufferFeature,
  runSimulation,
  warmupSimulationEngine,
};

export type Lib = typeof lib;

Comlink.transferHandlers.set("EITHER", EitherHandler);
Comlink.expose(lib);
