import * as Comlink from "comlink";
import { runPtsnet } from "./worker";

const lib = { runPtsnet };

export type PtsnetLib = typeof lib;

Comlink.expose(lib);
