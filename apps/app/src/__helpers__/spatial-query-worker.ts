import * as Comlink from "comlink";
import { workerAPI } from "src/lib/spatial-query/worker-api";

// Bridges `new Worker(...)` to the in-process worker API over a MessageChannel
// so the worker branch of runQuery can be exercised without spawning a real
// thread. Comlink talks to `port`, which is wired to the exposed workerAPI.
export class FakeSpatialQueryWorker {
  private readonly port: MessagePort;

  constructor() {
    const channel = new MessageChannel();
    Comlink.expose(workerAPI, channel.port1);
    this.port = channel.port2;
  }

  postMessage(message: unknown, transfer: Transferable[] = []) {
    this.port.postMessage(message, transfer);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    this.port.addEventListener(type, listener);
    this.port.start();
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) {
    this.port.removeEventListener(type, listener);
  }

  terminate() {
    this.port.close();
  }
}
