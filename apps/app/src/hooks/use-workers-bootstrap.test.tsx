import { renderHook, waitFor } from "@testing-library/react";
import { stubFeatureOn } from "src/__helpers__/feature-flags";
import { useWorkersBootstrap } from "./use-workers-bootstrap";

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

describe("useWorkersBootstrap", () => {
  beforeAll(() => {
    stubFeatureOn("FLAG_LONG_LIVED_WORKERS");
  });

  beforeEach(() => {
    configureWorkerReuse.mockClear();
    warmupSimulationEngine.mockClear();
  });

  it("preloads and warms the simulation worker", async () => {
    const { result } = renderHook(() => useWorkersBootstrap(true));

    await waitFor(() => expect(result.current).toBe(true));
    expect(configureWorkerReuse).toHaveBeenCalledWith(true);
    expect(warmupSimulationEngine).toHaveBeenCalledTimes(1);
  });

  it("stays not ready until enabled", () => {
    const { result } = renderHook(() => useWorkersBootstrap(false));

    expect(result.current).toBe(false);
    expect(configureWorkerReuse).not.toHaveBeenCalled();
  });
});
