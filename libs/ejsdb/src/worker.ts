import * as Comlink from "comlink";
import { api } from "./worker-api";
import { withErrorNormalization } from "./worker-api-errors";

export type { DbWorkerApi } from "./worker-api";

Comlink.expose(withErrorNormalization(api));
