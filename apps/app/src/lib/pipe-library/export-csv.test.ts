import { vi } from "vitest";
import Papa from "papaparse";
import type { PipeMaterial } from "@epanet-js/pipe-library";

const mockWrite = vi.fn<(data: string) => Promise<void>>();
const mockClose = vi.fn<() => Promise<void>>();
const mockCreateWritable = vi.fn(() =>
  Promise.resolve({ write: mockWrite, close: mockClose }),
);
const mockGetFile = vi.fn(() => Promise.resolve(new File([], "test.csv")));

const mockHandle = {
  createWritable: mockCreateWritable,
  getFile: mockGetFile,
} as unknown as FileSystemFileHandle;

vi.mock("src/lib/export/file-system-helpers", () => ({
  FileSystemHelpers: {
    openFileInOpfs: vi.fn(() => Promise.resolve(mockHandle)),
    triggerDownload: vi.fn(() => Promise.resolve()),
  },
}));

import { FileSystemHelpers } from "src/lib/export/file-system-helpers";
import { exportCsv } from "./export-csv";

describe("exportCsv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates a CSV with header and rows for all materials", async () => {
    const materials: PipeMaterial[] = [
      {
        label: "Cast Iron",
        entries: [
          { age: 0, roughness: 100 },
          { age: 10, roughness: 120 },
        ],
      },
      {
        label: "PVC",
        entries: [{ age: 0, roughness: 150 }],
      },
    ];

    await exportCsv(materials, "net");

    const csv = mockWrite.mock.calls[0][0];
    const parsed = Papa.parse<string[]>(csv, { header: false });
    const rows = parsed.data;

    expect(rows[0]).toEqual(["Material Name", "Age", "Roughness"]);
    expect(rows[1]).toEqual(["Cast Iron", "0", "100"]);
    expect(rows[2]).toEqual(["Cast Iron", "10", "120"]);
    expect(rows[3]).toEqual(["PVC", "0", "150"]);
  });

  it("handles null values in entries", async () => {
    const materials: PipeMaterial[] = [
      { label: "M1", entries: [{ age: null, roughness: null }] },
    ];

    await exportCsv(materials, "net");

    const csv = mockWrite.mock.calls[0][0];
    const parsed = Papa.parse<string[]>(csv, { header: false });

    expect(parsed.data[1]).toEqual(["M1", "", ""]);
  });

  it("uses correct file name format", async () => {
    await exportCsv(
      [{ label: "M1", entries: [{ age: 0, roughness: 100 }] }],
      "my-network",
    );

    expect(FileSystemHelpers.openFileInOpfs).toHaveBeenCalledWith(
      "my-network-pipe-library.csv",
    );
    expect(FileSystemHelpers.triggerDownload).toHaveBeenCalledWith(
      "my-network-pipe-library.csv",
      mockHandle,
    );
  });
});
