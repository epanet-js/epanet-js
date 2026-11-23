import Papa from "papaparse";
import type { PipeMaterial } from "@epanet-js/hydraulic-model";
import { serializeMaterialsToCsv } from "./export-csv";

describe("serializeMaterialsToCsv", () => {
  it("generates a CSV with header and rows for all materials", () => {
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

    const csv = serializeMaterialsToCsv(materials);
    const rows = Papa.parse<string[]>(csv, { header: false }).data;

    expect(rows[0]).toEqual(["Material Name", "Age", "Roughness"]);
    expect(rows[1]).toEqual(["Cast Iron", "0", "100"]);
    expect(rows[2]).toEqual(["Cast Iron", "10", "120"]);
    expect(rows[3]).toEqual(["PVC", "0", "150"]);
  });

  it("handles null values in entries", () => {
    const materials: PipeMaterial[] = [
      { label: "M1", entries: [{ age: null, roughness: null }] },
    ];

    const csv = serializeMaterialsToCsv(materials);
    const rows = Papa.parse<string[]>(csv, { header: false }).data;

    expect(rows[1]).toEqual(["M1", "", ""]);
  });
});
