import * as Comlink from "comlink";
import { api } from "./worker-api";

export type { DbWorkerApi } from "./worker-api";

Comlink.expose(api);
