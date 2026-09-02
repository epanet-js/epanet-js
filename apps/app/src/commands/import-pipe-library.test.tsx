import { renderHook, act } from "@testing-library/react";
import { vi } from "vitest";
import Papa from "papaparse";
import { stubUserTracking } from "src/__helpers__/user-tracking";

vi.mock("browser-fs-access", () => ({
  fileOpen: vi.fn(),
}));

import { fileOpen } from "browser-fs-access";
import { useImportPipeLibrary } from "./import-pipe-library";

const createFile = (content: string, name: string, type: string): File =>
  new File([new Blob([content], { type })], name, { type });

describe("useImportPipeLibrary", () => {
  let tracking: ReturnType<typeof stubUserTracking>;

  beforeEach(() => {
    vi.clearAllMocks();
    tracking = stubUserTracking();
  });

  it("returns nothing and does not track when the picker is cancelled", async () => {
    vi.mocked(fileOpen).mockRejectedValue(
      Object.assign(new Error(), { name: "AbortError" }),
    );

    const { result } = renderHook(() => useImportPipeLibrary());

    let outcome!: Awaited<ReturnType<typeof result.current>>;
    await act(async () => {
      outcome = await result.current();
    });

    expect(outcome).toBeNull();
    expect(tracking.capture).not.toHaveBeenCalled();
  });

  it("parses the picked file and tracks the import", async () => {
    const csv = Papa.unparse({
      fields: ["Material Name", "Age", "Roughness"],
      data: [["Cast Iron", 0, 100]],
    });
    vi.mocked(fileOpen).mockResolvedValue(
      createFile(csv, "library.csv", "text/csv"),
    );

    const { result } = renderHook(() => useImportPipeLibrary());

    let outcome!: Awaited<ReturnType<typeof result.current>>;
    await act(async () => {
      outcome = await result.current();
    });

    expect(outcome?.status).toBe("success");
    expect(outcome?.pipeLibrary).toHaveLength(1);
    expect(tracking.capture).toHaveBeenCalledWith({
      name: "pipeLibrary.importedFromFile",
      status: "success",
      materialsCount: 1,
      format: "csv",
    });
  });
});
