import * as XLSX from "xlsx";
import type { PipeMaterial } from "@epanet-js/hydraulic-model";
import { serializeMaterialsToXlsx } from "./export-xlsx";

describe("serializeMaterialsToXlsx", () => {
  it("creates a single Materials worksheet", async () => {
    const materials: PipeMaterial[] = [
      { label: "Cast Iron", entries: [{ age: 0, roughness: 100 }] },
      { label: "PVC", entries: [{ age: 0, roughness: 150 }] },
    ];

    const buffer = await serializeMaterialsToXlsx(materials);
    const workbook = XLSX.read(buffer, { type: "array" });

    expect(workbook.SheetNames).toEqual(["Materials"]);
  });

  it("writes header and data rows for all materials", async () => {
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

    const buffer = await serializeMaterialsToXlsx(materials);
    const workbook = XLSX.read(buffer, { type: "array" });
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(
      workbook.Sheets["Materials"],
      { header: 1 },
    );

    expect(rows[0]).toEqual(["Material Name", "Age", "Roughness"]);
    expect(rows[1]).toEqual(["Cast Iron", 0, 100]);
    expect(rows[2]).toEqual(["Cast Iron", 10, 120]);
    expect(rows[3]).toEqual(["PVC", 0, 150]);
  });

  it("handles null values in entries", async () => {
    const materials: PipeMaterial[] = [
      {
        label: "M1",
        entries: [{ age: null, roughness: null }],
      },
    ];

    const buffer = await serializeMaterialsToXlsx(materials);
    const workbook = XLSX.read(buffer, { type: "array" });
    const rows = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(
      workbook.Sheets["Materials"],
      { header: 1 },
    );

    expect(rows[1]).toEqual(["M1"]);
  });
});
