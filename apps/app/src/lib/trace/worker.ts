import * as Comlink from "comlink";
import { workerAPI } from "./worker-api";

Comlink.expose(workerAPI);
