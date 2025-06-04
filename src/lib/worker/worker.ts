import { getIssues } from "@placemarkio/check-geojson";
import { fileToGeoJSON } from "src/lib/convert";
import * as Comlink from "comlink";
import { EitherHandler } from "./shared";
import { bufferFeature } from "src/lib/buffer";
import { runSimulation } from "src/simulation/epanet/worker";

const lib = {
  getIssues,
  bufferFeature,
  fileToGeoJSON,
  runSimulation,
};

export type Lib = typeof lib;

Comlink.transferHandlers.set("EITHER", EitherHandler);
Comlink.expose(lib);
