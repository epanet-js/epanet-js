import { renderHook, waitFor } from "@testing-library/react";
import { useWorkersBootstrap } from "./use-workers-bootstrap";

describe("useWorkersBootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preloads all workers", async () => {
    const { result } = renderHook(() => useWorkersBootstrap(true));

    await waitFor(() => expect(result.current).toBe(true));
    expect(warmupSimulationEngine).toHaveBeenCalledTimes(1);
    expect(getTraceWorker).toHaveBeenCalledTimes(1);
    expect(getConnectivityTraceWorker).toHaveBeenCalledTimes(1);
    expect(getOrphanAssetsWorker).toHaveBeenCalledTimes(1);
    expect(getCustomerPointsWorker).toHaveBeenCalledTimes(1);
    expect(getCrossingPipesWorker).toHaveBeenCalledTimes(1);
    expect(getProximityAnomaliesWorker).toHaveBeenCalledTimes(1);
    expect(getSpatialQueryWorker).toHaveBeenCalledTimes(1);
  });

  it("stays not ready until feature flags are ready", () => {
    const { result } = renderHook(() => useWorkersBootstrap(false));

    expect(result.current).toBe(false);
  });
});

const warmupSimulationEngine = vi.fn();
vi.mock("src/lib/worker", () => ({
  lib: {
    warmupSimulationEngine: () => {
      warmupSimulationEngine();
      return Promise.resolve();
    },
  },
}));

const getTraceWorker = vi.fn();
vi.mock("src/lib/trace/get-worker", () => ({ getTraceWorker }));

const getConnectivityTraceWorker = vi.fn();
vi.mock("src/lib/network-review/connectivity-trace/get-worker", () => ({
  getConnectivityTraceWorker,
}));

const getOrphanAssetsWorker = vi.fn();
vi.mock("src/lib/network-review/orphan-assets/get-worker", () => ({
  getOrphanAssetsWorker,
}));

const getCustomerPointsWorker = vi.fn();
vi.mock("src/lib/customer-points/get-worker", () => ({
  getCustomerPointsWorker,
}));

const getCrossingPipesWorker = vi.fn();
vi.mock("src/lib/network-review/crossing-pipes/get-worker", () => ({
  getCrossingPipesWorker,
}));

const getProximityAnomaliesWorker = vi.fn();
vi.mock("src/lib/network-review/proximity-anomalies/get-worker", () => ({
  getProximityAnomaliesWorker,
}));

const getSpatialQueryWorker = vi.fn();
vi.mock("src/map/mode-handlers/area-selection/get-worker", () => ({
  getSpatialQueryWorker,
}));

vi.mock("src/infra/worker", async (importActual) => {
  const actual = await importActual<typeof import("src/infra/worker")>();
  return { ...actual, canUseWorker: () => true };
});
