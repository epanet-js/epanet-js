import * as Comlink from "comlink";
import { api } from "./db-worker-api";

export type { DbWorkerApi } from "./db-worker-api";

Comlink.expose(api);
