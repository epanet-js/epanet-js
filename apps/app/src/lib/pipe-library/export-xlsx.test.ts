import { vi } from "vitest";
import * as XLSX from "xlsx";
import type { PipeMaterial } from "@epanet-js/pipe-library";

const mockWrite = vi.fn<(data: BufferSource) => Promise<void>>();
const mockClose = vi.fn<() => Promise<void>>();
const mockCreateWritable = vi.fn(() =>
  Promise.resolve({ write: mockWrite, close: mockClose }),
);
const mockGetFile = vi.fn(() => Promise.resolve(new File([], "test.xlsx")));

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
import { exportXlsx } from "./export-xlsx";

describe("exportXlsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates one worksheet per material", async () => {
    const materials: PipeMaterial[] = [
      { label: "Cast Iron", entries: [{ age: 0, roughness: 100 }] },
      { label: "PVC", entries: [{ age: 0, roughness: 150 }] },
    ];

    await exportXlsx(materials, "my-network");

    const buffer = mockWrite.mock.calls[0][0] as ArrayBuffer;
    const workbook = XLSX.read(buffer, { type: "array" });

    expect(workbook.SheetNames).toEqual(["Cast Iron", "PVC"]);
  });

  it("writes header and data rows", async () => {
    const materials: PipeMaterial[] = [
      {
        label: "Cast Iron",
        entries: [
          { age: 0, roughness: 100 },
          { age: 10, roughness: 120 },
        ],
      },
    ];

    await exportXlsx(materials, "net");

    const buffer = mockWrite.mock.calls[0][0] as ArrayBuffer;
    const workbook = XLSX.read(buffer, { type: "array" });
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(
      workbook.Sheets["Cast Iron"],
      { header: 1 },
    );

    expect(rows[0]).toEqual(["Age", "Roughness"]);
    expect(rows[1]).toEqual([0, 100]);
    expect(rows[2]).toEqual([10, 120]);
  });

  it("handles null values in entries", async () => {
    const materials: PipeMaterial[] = [
      {
        label: "M1",
        entries: [{ age: null, roughness: null }],
      },
    ];

    await exportXlsx(materials, "net");

    const buffer = mockWrite.mock.calls[0][0] as ArrayBuffer;
    const workbook = XLSX.read(buffer, { type: "array" });
    const rows = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(
      workbook.Sheets["M1"],
      { header: 1 },
    );

    expect(rows[1]).toEqual([]);
  });

  it("sanitizes sheet names containing unsupported characters in worksheet names", async () => {
    const materials: PipeMaterial[] = [
      { label: "Cast [Iron]:Test", entries: [{ age: 0, roughness: 100 }] },
      {
        label: "A".repeat(40),
        entries: [{ age: 0, roughness: 100 }],
      },
    ];

    await exportXlsx(materials, "net");

    const buffer = mockWrite.mock.calls[0][0] as ArrayBuffer;
    const workbook = XLSX.read(buffer, { type: "array" });

    expect(workbook.SheetNames[0]).toBe("Cast _Iron__Test");
    expect(workbook.SheetNames[1]).toHaveLength(31);
  });

  it("uses correct file name format", async () => {
    await exportXlsx(
      [{ label: "M1", entries: [{ age: 0, roughness: 100 }] }],
      "my-network",
    );

    expect(FileSystemHelpers.openFileInOpfs).toHaveBeenCalledWith(
      "my-network-pipe-library.xlsx",
    );
    expect(FileSystemHelpers.triggerDownload).toHaveBeenCalledWith(
      "my-network-pipe-library.xlsx",
      mockHandle,
    );
  });
});
