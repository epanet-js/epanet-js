import * as XLSX from "xlsx";
import Papa from "papaparse";
import { parsePipeLibraryFile } from "./parse-pipe-library-file";

describe("parsePipeLibraryFile", () => {
  it("parses a valid CSV file", async () => {
    const csv = Papa.unparse({
      fields: ["Material Name", "Age", "Roughness"],
      data: [
        ["Cast Iron", 0, 100],
        ["Cast Iron", 10, 120],
        ["PVC", 0, 150],
      ],
    });

    const result = await parsePipeLibraryFile(
      createFile(csv, "library.csv", "text/csv"),
    );

    expect(result?.status).toBe("success");
    expect(result?.pipeLibrary).toHaveLength(2);
    expect(result?.pipeLibrary![0]).toEqual({
      label: "Cast Iron",
      entries: [
        { age: 0, roughness: 100 },
        { age: 10, roughness: 120 },
      ],
    });
    expect(result?.pipeLibrary![1]).toEqual({
      label: "PVC",
      entries: [{ age: 0, roughness: 150 }],
    });
  });

  it("keeps the first casing and reports rows that redefine it", async () => {
    const csv = Papa.unparse({
      fields: ["Material Name", "Age", "Roughness"],
      data: [
        ["Cast Iron", 0, 100],
        ["cast iron", 10, 120],
        ["PVC", 0, 150],
      ],
    });

    const result = await parsePipeLibraryFile(
      createFile(csv, "library.csv", "text/csv"),
    );

    expect(result?.status).toBe("partial");
    expect(result?.errors).toEqual([
      {
        material: "cast iron",
        message: "pipeLibrary.import.duplicateMaterial",
      },
    ]);
    expect(result?.pipeLibrary).toEqual([
      { label: "Cast Iron", entries: [{ age: 0, roughness: 100 }] },
      { label: "PVC", entries: [{ age: 0, roughness: 150 }] },
    ]);
  });

  it("reports a duplicated label once however many rows use it", async () => {
    const csv = Papa.unparse({
      fields: ["Material Name", "Age", "Roughness"],
      data: [
        ["Cast Iron", 0, 100],
        ["cast iron", 10, 120],
        ["cast iron", 20, 140],
      ],
    });

    const result = await parsePipeLibraryFile(
      createFile(csv, "library.csv", "text/csv"),
    );

    expect(result?.errors).toHaveLength(1);
  });

  it("parses a valid XLSX file", async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Material Name", "Age", "Roughness"],
      ["Cast Iron", 0, 100],
      ["Cast Iron", 10, 120],
      ["PVC", 0, 150],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Materials");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

    const result = await parsePipeLibraryFile(
      createFile(
        buffer,
        "library.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    );

    expect(result?.status).toBe("success");
    expect(result?.pipeLibrary).toHaveLength(2);
    expect(result?.pipeLibrary![0].label).toBe("Cast Iron");
    expect(result?.pipeLibrary![0].entries).toEqual([
      { age: 0, roughness: 100 },
      { age: 10, roughness: 120 },
    ]);
    expect(result?.pipeLibrary![1].label).toBe("PVC");
  });

  it("returns error for an empty CSV", async () => {
    const csv = "Material Name,Age,Roughness\n";

    const result = await parsePipeLibraryFile(
      createFile(csv, "empty.csv", "text/csv"),
    );

    expect(result?.status).toBe("error");
    expect(result?.errors[0].message).toBe("pipeLibrary.import.emptyFile");
  });

  it("returns partial result with sanitized entries for invalid values", async () => {
    const csv = Papa.unparse({
      fields: ["Material Name", "Age", "Roughness"],
      data: [
        ["Cast Iron", 0, -5],
        ["PVC", -1, 150],
      ],
    });
    const result = await parsePipeLibraryFile(
      createFile(csv, "bad.csv", "text/csv"),
    );

    expect(result?.status).toBe("partial");
    expect(result?.errors).toHaveLength(2);
    expect(result?.errors[0].material).toBe("Cast Iron");
    expect(result?.errors[1].material).toBe("PVC");
    expect(result?.pipeLibrary).toHaveLength(2);
    expect(result?.pipeLibrary![0]).toEqual({
      label: "Cast Iron",
      entries: [{ age: 0, roughness: null }],
    });
    expect(result?.pipeLibrary![1]).toEqual({
      label: "PVC",
      entries: [{ age: null, roughness: 150 }],
    });
  });

  it("keeps valid entries alongside invalid ones in the same material", async () => {
    const csv = Papa.unparse({
      fields: ["Material Name", "Age", "Roughness"],
      data: [
        ["Cast Iron", 0, 100],
        ["Cast Iron", 10, -5],
      ],
    });
    const result = await parsePipeLibraryFile(
      createFile(csv, "mixed.csv", "text/csv"),
    );

    expect(result?.status).toBe("partial");
    expect(result?.errors).toHaveLength(1);
    expect(result?.pipeLibrary![0].entries).toEqual([
      { age: 0, roughness: 100 },
      { age: 10, roughness: null },
    ]);
  });
});

const createFile = (
  content: string | ArrayBuffer,
  name: string,
  type: string,
): File => {
  const blob =
    content instanceof ArrayBuffer
      ? new Blob([content], { type })
      : new Blob([content], { type });
  return new File([blob], name, { type });
};
