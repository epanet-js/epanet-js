import { getIssues } from "@placemarkio/check-geojson";
import * as Comlink from "comlink";
import { EitherHandler } from "./shared";
import { bufferFeature } from "src/lib/buffer";
import { runSimulation } from "src/simulation/epanet/worker";
import { runEPSSimulation } from "src/simulation/epanet/worker-eps";

export const lib = {
  getIssues,
  bufferFeature,
  runSimulation,
  runEPSSimulation,
};

export type Lib = typeof lib;

Comlink.transferHandlers.set("EITHER", EitherHandler);
Comlink.expose(lib);
