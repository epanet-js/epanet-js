import { ExportEntry } from "../types";
import { exportCsv } from "./export-csv";

describe("export-csv", () => {
  it("uses object keys as headers", async () => {
    const entry: ExportEntry = {
      format: "csv",
      name: "junction",
      data: [{ id: 1, name: "J1", elevation: 10 }],
    };

    const [exported] = exportCsv(entry);

    const text = await exported.blob.text();
    const [header, row] = text.split("\n").map((l) => l.trim());

    expect(header).toBe("id,name,elevation");
    expect(row).toBe("1,J1,10");

    expect(exported.fileName).toBe("junction.csv");
    expect(exported.extensions).toEqual([".csv"]);
    expect(exported.mimeTypes).toEqual(["text/csv"]);
    expect(exported.description).toBe("CSV");
  });
});
