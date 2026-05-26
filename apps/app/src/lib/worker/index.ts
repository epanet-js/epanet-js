import type { Lib } from "./worker";
import { lib as syncLib } from "./worker";
import * as Comlink from "comlink";
import { EitherHandler } from "./shared";

Comlink.transferHandlers.set("EITHER", EitherHandler);

const hasWebWorker = () => {
  try {
    return typeof window !== "undefined" && window.Worker !== undefined;
  } catch {
    return false;
  }
};

export const lib = hasWebWorker()
  ? Comlink.wrap<Lib>(
      new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }),
    )
  : syncLib;
