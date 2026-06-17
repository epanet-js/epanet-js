import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import * as Comlink from "comlink";
import { runQuery } from "./run-query";
import { workerAPI } from "./worker-api";
import * as workerInfra from "src/infra/worker";
import { Position } from "src/types";

const IDS = {
  J1: 1,
  J2: 2,
  J3: 3,
  P1: 10,
  CP_INSIDE: 100,
  CP_OUTSIDE: 101,
} as const;

// Bridges `new Worker(...)` to the in-process worker API over a MessageChannel
// so the worker branch of runQuery can be exercised without spawning a real
// thread. Comlink talks to `port`, which is wired to the exposed workerAPI.
class FakeWorker {
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

const buildModel = () =>
  HydraulicModelBuilder.with()
    .aJunction(IDS.J1, { coordinates: [0, 0] })
    .aJunction(IDS.J2, { coordinates: [10, 0] })
    .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
    .aJunction(IDS.J3, { coordinates: [20, 20] })
    .aCustomerPoint(IDS.CP_INSIDE, { coordinates: [5, 0] })
    .aCustomerPoint(IDS.CP_OUTSIDE, { coordinates: [50, 50] })
    .build();

const rectangle: Position[] = [
  [-1, -1],
  [11, -1],
  [11, 1],
  [-1, 1],
  [-1, -1],
];

describe("runQuery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    { canUseWorker: false, label: "non-encoded in-process query (no worker)" },
    { canUseWorker: true, label: "encoded worker query" },
  ])(
    "returns contained assets and customer points ($label)",
    async ({ canUseWorker }) => {
      vi.spyOn(workerInfra, "canUseWorker").mockReturnValue(canUseWorker);
      if (canUseWorker) {
        vi.stubGlobal("Worker", FakeWorker);
      }

      const { assetIds, customerPointIds } = await runQuery(
        buildModel(),
        rectangle,
      );

      expect(assetIds).toContain(IDS.J1);
      expect(assetIds).toContain(IDS.J2);
      expect(assetIds).toContain(IDS.P1);
      expect(assetIds).not.toContain(IDS.J3);
      expect(customerPointIds).toContain(IDS.CP_INSIDE);
      expect(customerPointIds).not.toContain(IDS.CP_OUTSIDE);
    },
  );

  it("excludes customer points when includeCustomerPoints is false", async () => {
    vi.spyOn(workerInfra, "canUseWorker").mockReturnValue(false);

    const { assetIds, customerPointIds } = await runQuery(
      buildModel(),
      rectangle,
      undefined,
      "array",
      false,
    );

    expect(assetIds).toContain(IDS.J1);
    expect(customerPointIds).toEqual([]);
  });
});
