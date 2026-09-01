import { renderHook, waitFor } from "@testing-library/react";
import { stubFeaturesOn } from "src/__helpers__/feature-flags";
import { useWorkersBootstrap } from "./use-workers-bootstrap";

describe("useWorkersBootstrap", () => {
  beforeAll(() => {
    stubFeaturesOn(["FLAG_LONG_LIVED_WORKERS", "FLAG_FULL_OFFLINE_SUPPORT"]);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preloads all workers", async () => {
    const { result } = renderHook(() => useWorkersBootstrap(true));

    await waitFor(() => expect(result.current).toBe(true));
    expect(configureWorkerReuse).toHaveBeenCalledWith(true);
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
    expect(configureWorkerReuse).not.toHaveBeenCalled();
  });
});

const configureWorkerReuse = vi.fn();
const warmupSimulationEngine = vi.fn();
vi.mock("src/lib/worker", () => ({
  lib: {
    configureWorkerReuse: (value: boolean) => {
      configureWorkerReuse(value);
    },
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
