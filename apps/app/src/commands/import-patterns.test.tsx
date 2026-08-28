import { renderHook, act } from "@testing-library/react";
import { vi } from "vitest";
import type { PatternType } from "src/hydraulic-model";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { useImportPatterns } from "./import-patterns";

vi.mock("browser-fs-access", () => ({ fileOpen: vi.fn() }));

import { fileOpen } from "browser-fs-access";

const labels: Record<PatternType, string> = {
  demand: "Demand",
  reservoirHead: "Reservoir head",
  pumpSpeed: "Pump speed",
  qualitySourceStrength: "Quality source strength",
  energyPrice: "Energy price",
};

const csvFile = (body: string) =>
  new File([`Pattern name,Type,Interval,Multipliers\n${body}`], "p.csv", {
    type: "text/csv",
  });

describe("useImportPatterns", () => {
  let tracking: ReturnType<typeof stubUserTracking>;

  beforeEach(() => {
    vi.clearAllMocks();
    tracking = stubUserTracking();
  });

  it("parses the chosen file and tracks the import", async () => {
    vi.mocked(fileOpen).mockResolvedValue(
      csvFile("PAT1,Demand,1:00,1,2") as never,
    );
    const { result } = renderHook(() => useImportPatterns());

    let parsed;
    await act(async () => {
      parsed = await result.current(labels);
    });

    expect(parsed).toMatchObject({
      status: "success",
      format: "csv",
      patterns: [{ label: "PAT1", type: "demand", multipliers: [1, 2] }],
    });
    expect(tracking.capture).toHaveBeenCalledWith({
      name: "patterns.importedFromFile",
      status: "success",
      format: "csv",
      count: 1,
    });
  });

  it("returns null and tracks nothing when the picker is cancelled", async () => {
    const abort = new Error("cancelled");
    abort.name = "AbortError";
    vi.mocked(fileOpen).mockRejectedValue(abort);
    const { result } = renderHook(() => useImportPatterns());

    let parsed;
    await act(async () => {
      parsed = await result.current(labels);
    });

    expect(parsed).toBeNull();
    expect(tracking.capture).not.toHaveBeenCalled();
  });
});
