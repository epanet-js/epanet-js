import { getIssues } from "@placemarkio/check-geojson";
import { fromGeoJSON, fileToGeoJSON } from "src/lib/convert";
import * as Comlink from "comlink";
import { EitherHandler } from "./shared";
import { bufferFeature } from "src/lib/buffer";
import { booleanFeatures } from "src/lib/map_operations_deprecated/boolean_features";
import { runSimulation } from "src/simulation/epanet/worker";

const lib = {
  getIssues,
  bufferFeature,
  booleanFeatures,
  fileToGeoJSON,
  fromGeoJSON,
  runSimulation,
};

export type Lib = typeof lib;

Comlink.transferHandlers.set("EITHER", EitherHandler);
Comlink.expose(lib);
