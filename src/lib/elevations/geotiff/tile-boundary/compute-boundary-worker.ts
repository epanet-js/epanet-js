import * as Comlink from "comlink";
import { boundaryWorkerAPI } from "./compute-boundary-worker-api";

Comlink.expose(boundaryWorkerAPI);
