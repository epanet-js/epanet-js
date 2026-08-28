import type { PatternType } from "src/hydraulic-model";
import { parsePatternsFile, resolveType } from "./parse-patterns-file";

const labels: Record<PatternType, string> = {
  demand: "Demand",
  reservoirHead: "Reservoir head",
  pumpSpeed: "Pump speed",
  qualitySourceStrength: "Quality source strength",
  energyPrice: "Energy price",
};

const HEADER = "Pattern name,Type,Interval,Multipliers";

const csvFile = (...lines: string[]) =>
  new File([[HEADER, ...lines].join("\n")], "patterns.csv", {
    type: "text/csv",
  });

describe("resolveType", () => {
  it("matches the enum key", () => {
    expect(resolveType("pumpSpeed", labels)).toEqual("pumpSpeed");
  });

  it("matches the translated label", () => {
    expect(resolveType("Reservoir head", labels)).toEqual("reservoirHead");
  });

  it("ignores case and extra whitespace", () => {
    expect(resolveType("  pump   SPEED ", labels)).toEqual("pumpSpeed");
  });

  it("accepts an unambiguous partial match", () => {
    expect(resolveType("energy", labels)).toEqual("energyPrice");
  });

  it("falls back to uncategorized when the partial is ambiguous", () => {
    expect(resolveType("e", labels)).toBeUndefined();
  });

  it("falls back to uncategorized for an unknown type", () => {
    expect(resolveType("something else", labels)).toBeUndefined();
  });

  it("treats a blank cell as uncategorized", () => {
    expect(resolveType("", labels)).toBeUndefined();
    expect(resolveType(null, labels)).toBeUndefined();
    expect(resolveType("   ", labels)).toBeUndefined();
  });

  it.each([
    ["a phrase built around the label", "Pump speed pattern", "pumpSpeed"],
    ["a label with a leading word", "The Demand", "demand"],
    ["an abbreviation of the label", "speed", "pumpSpeed"],
  ])("matches %s", (_case, cell, expected) => {
    expect(resolveType(cell, labels)).toEqual(expected);
  });

  it.each([
    ["a number", 42],
    ["punctuation instead of a space", "pump-speed"],
    ["an underscored enum key", "pump_speed"],
    ["a phrase naming two types", "Pump speed and demand"],
  ])("leaves %s uncategorized", (_case, cell) => {
    expect(resolveType(cell, labels)).toBeUndefined();
  });
});

describe("parsePatternsFile", () => {
  it("reads one pattern per row with the multipliers along the row", async () => {
    const result = await parsePatternsFile(
      csvFile("PAT1,Demand,1:00,0.8,1.2,1.4", "PAT2,Pump speed,1:00,1,1.1"),
      labels,
    );

    expect(result.status).toEqual("success");
    expect(result.format).toEqual("csv");
    expect(result.patterns).toEqual([
      {
        label: "PAT1",
        type: "demand",
        intervalSeconds: 3600,
        multipliers: [0.8, 1.2, 1.4],
      },
      {
        label: "PAT2",
        type: "pumpSpeed",
        intervalSeconds: 3600,
        multipliers: [1, 1.1],
      },
    ]);
  });

  it("imports a blank type as uncategorized", async () => {
    const result = await parsePatternsFile(csvFile("PAT1,,1:00,1"), labels);

    expect(result.patterns[0].type).toBeUndefined();
    expect(result.status).toEqual("success");
  });

  describe("interval", () => {
    it("accepts H:MM, H:MM:SS and decimal hours", async () => {
      const result = await parsePatternsFile(
        csvFile("A,Demand,0:30,1", "B,Demand,1:00:30,1", "C,Demand,1.5,1"),
        labels,
      );

      expect(result.patterns.map((p) => p.intervalSeconds)).toEqual([
        1800, 3630, 5400,
      ]);
    });

    it("leaves it undefined when blank, without erroring", async () => {
      const result = await parsePatternsFile(
        csvFile("A,Demand,,1", "B,Demand,,1"),
        labels,
      );

      expect(result.patterns.map((p) => p.intervalSeconds)).toEqual([
        undefined,
        undefined,
      ]);
      expect(result.errors).toEqual([]);
      expect(result.status).toEqual("success");
    });

    it("skips a pattern whose interval is present but unreadable", async () => {
      const result = await parsePatternsFile(
        csvFile("A,Demand,1:00,1", "B,Demand,not-a-time,1"),
        labels,
      );

      expect(result.status).toEqual("partial");
      expect(result.patterns.map((p) => p.label)).toEqual(["A"]);
      expect(result.errors).toEqual([
        {
          label: "B",
          message: "patterns.import.invalidInterval",
          value: "not-a-time",
          row: 3,
        },
      ]);
    });

    it("accepts a mix of blank and valid intervals", async () => {
      const result = await parsePatternsFile(
        csvFile("A,Demand,1:00,1", "B,Demand,,1"),
        labels,
      );

      expect(result.status).toEqual("success");
      expect(result.patterns.map((p) => p.intervalSeconds)).toEqual([
        3600,
        undefined,
      ]);
    });
  });

  describe("rejecting files that are not patterns", () => {
    it("rejects a file whose interval column never reads as a duration", async () => {
      const result = await parsePatternsFile(
        csvFile("C1,Tank volume,X,0,1.5,3", "C1,Tank volume,Y,0,120,260"),
        labels,
      );

      expect(result.status).toEqual("error");
      expect(result.errors).toEqual([
        { message: "patterns.import.notAValidPatternsFile" },
      ]);
      expect(result.patterns).toEqual([]);
    });

    it("reports nothing but the format error, whatever else the rows contain", async () => {
      const result = await parsePatternsFile(
        csvFile(
          "C1,Tank volume,X,0,1.5",
          "C1,Tank volume,Y,0,120",
          ",Tank volume,X,0,3",
          "C2,Tank volume,X,oops",
        ),
        labels,
      );

      expect(result.errors).toEqual([
        { message: "patterns.import.notAValidPatternsFile" },
      ]);
    });

    it("rejects a file where most rows are malformed", async () => {
      const result = await parsePatternsFile(
        csvFile(
          "A,Demand,1:00,1",
          "B,Demand,nope,1",
          ",Demand,1:00,1",
          "D,Demand,1:00,oops",
        ),
        labels,
      );

      expect(result.status).toEqual("error");
      expect(result.errors).toEqual([
        { message: "patterns.import.notAValidPatternsFile" },
      ]);
    });

    it("keeps a file where a minority of rows are malformed", async () => {
      const result = await parsePatternsFile(
        csvFile(
          "A,Demand,1:00,1",
          "B,Demand,1:00,1",
          "C,Demand,1:00,1",
          "D,Demand,nope,1",
        ),
        labels,
      );

      expect(result.status).toEqual("partial");
      expect(result.patterns.map((p) => p.label)).toEqual(["A", "B", "C"]);
    });

    it("rejects one pattern spread over several rows", async () => {
      const result = await parsePatternsFile(
        csvFile("A,Demand,1:00,1", "A,Demand,1:00,2", "A,Demand,1:00,3"),
        labels,
      );

      expect(result.status).toEqual("error");
      expect(result.errors).toEqual([
        { message: "patterns.import.notAValidPatternsFile" },
      ]);
    });

    it("accepts a file whose interval column is entirely blank", async () => {
      const result = await parsePatternsFile(
        csvFile("A,Demand,,1", "B,Demand,,2"),
        labels,
      );

      expect(result.status).toEqual("success");
    });
  });

  describe("header detection", () => {
    it("keeps the first row when the header is missing", async () => {
      const result = await parsePatternsFile(
        new File(["PAT1,Demand,1:00,0.8\nPAT2,Demand,1:00,1"], "p.csv"),
        labels,
      );

      expect(result.patterns.map((p) => p.label)).toEqual(["PAT1", "PAT2"]);
    });

    it("drops the first row when it is a header", async () => {
      const result = await parsePatternsFile(
        csvFile("PAT1,Demand,1:00,0.8"),
        labels,
      );

      expect(result.patterns.map((p) => p.label)).toEqual(["PAT1"]);
    });

    it("numbers rows from 1 when there is no header to skip", async () => {
      const result = await parsePatternsFile(
        new File(["PAT1,Demand,1:00,0.8\n,Demand,1:00,1"], "p.csv"),
        labels,
      );

      expect(result.errors).toEqual([
        { message: "patterns.import.missingLabel", row: 2 },
      ]);
    });

    it("numbers rows from 2 when the header takes row 1", async () => {
      const result = await parsePatternsFile(
        csvFile("PAT1,Demand,1:00,0.8", ",Demand,1:00,1"),
        labels,
      );

      expect(result.errors).toEqual([
        { message: "patterns.import.missingLabel", row: 3 },
      ]);
    });

    it("treats a translated header as a header too", async () => {
      const result = await parsePatternsFile(
        new File(
          ["Nombre,Tipo,Intervalo,Multiplicadores\nPAT1,Demand,1:00,0.8"],
          "p.csv",
        ),
        labels,
      );

      expect(result.patterns.map((p) => p.label)).toEqual(["PAT1"]);
    });
  });

  describe("blank rows", () => {
    it("skips a single blank row used as a spacer", async () => {
      const result = await parsePatternsFile(
        csvFile("PAT1,Demand,1:00,1", "", "PAT2,Demand,1:00,1"),
        labels,
      );

      expect(result.patterns.map((p) => p.label)).toEqual(["PAT1", "PAT2"]);
    });

    it("numbers error rows by their real position in the file", async () => {
      const result = await parsePatternsFile(
        csvFile("PAT1,Demand,1:00,1", "", ",Demand,1:00,2"),
        labels,
      );

      // Header is row 1, PAT1 row 2, the blank spacer row 3, the bad row 4.
      expect(result.errors).toEqual([
        { message: "patterns.import.missingLabel", row: 4 },
      ]);
    });

    it("stops reading at two consecutive blank rows", async () => {
      const result = await parsePatternsFile(
        csvFile("PAT1,Demand,1:00,1", "", "", "IGNORED,Demand,1:00,1"),
        labels,
      );

      expect(result.patterns.map((p) => p.label)).toEqual(["PAT1"]);
    });
  });

  it("skips a pattern with a gap between its multipliers", async () => {
    const result = await parsePatternsFile(
      csvFile("PAT1,Demand,1:00,1,,3,4", "PAT2,Demand,1:00,1,2"),
      labels,
    );

    expect(result.status).toEqual("partial");
    expect(result.patterns.map((p) => p.label)).toEqual(["PAT2"]);
    expect(result.errors).toEqual([
      {
        label: "PAT1",
        message: "patterns.import.missingMultiplier",
        row: 2,
      },
    ]);
  });

  it("ignores trailing blank multiplier cells", async () => {
    const result = await parsePatternsFile(
      csvFile("PAT1,Demand,1:00,1,2,,"),
      labels,
    );

    expect(result.patterns[0].multipliers).toEqual([1, 2]);
  });

  it("skips a pattern with a non-numeric multiplier rather than shifting the rest", async () => {
    const result = await parsePatternsFile(
      csvFile("PAT1,Demand,1:00,1,oops,3", "PAT2,Demand,1:00,1,2"),
      labels,
    );

    expect(result.status).toEqual("partial");
    expect(result.patterns.map((p) => p.label)).toEqual(["PAT2"]);
    expect(result.errors).toEqual([
      {
        label: "PAT1",
        message: "patterns.import.invalidMultiplier",
        value: "oops",
        row: 2,
      },
    ]);
  });

  it("reports only the first bad value in a pattern", async () => {
    const result = await parsePatternsFile(
      csvFile("PAT1,Demand,1:00,oops,nope", "PAT2,Demand,1:00,1"),
      labels,
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].value).toEqual("oops");
  });

  it("reports the reason when every pattern was disqualified", async () => {
    const result = await parsePatternsFile(
      csvFile("PAT1,Demand,1:00,oops"),
      labels,
    );

    expect(result.status).toEqual("partial");
    expect(result.patterns).toEqual([]);
    expect(result.errors.map((e) => e.message)).toEqual([
      "patterns.import.invalidMultiplier",
    ]);
  });

  it("reports a duplicated label once however many rows repeat it", async () => {
    const result = await parsePatternsFile(
      csvFile(
        "PAT1,Demand,1:00,1",
        "pat1,Demand,1:00,2",
        "PAT1,Demand,1:00,3",
        "PAT2,Demand,1:00,1",
        "PAT3,Demand,1:00,1",
        "PAT4,Demand,1:00,1",
      ),
      labels,
    );

    expect(result.patterns.map((p) => p.label)).toEqual([
      "PAT1",
      "PAT2",
      "PAT3",
      "PAT4",
    ]);
    expect(
      result.errors.filter(
        (e) => e.message === "patterns.import.duplicateLabel",
      ),
    ).toHaveLength(1);
  });

  it("skips a row with no label and reports it", async () => {
    const result = await parsePatternsFile(
      csvFile("PAT1,Demand,1:00,1", ",Demand,1:00,2"),
      labels,
    );

    expect(result.status).toEqual("partial");
    expect(result.patterns.map((p) => p.label)).toEqual(["PAT1"]);
    expect(result.errors).toEqual([
      { message: "patterns.import.missingLabel", row: 3 },
    ]);
  });

  it("reads a file with only a header as nothing to import", async () => {
    const result = await parsePatternsFile(csvFile(), labels);

    expect(result.status).toEqual("success");
    expect(result.patterns).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("keeps the row errors that explain why nothing could be read", async () => {
    const result = await parsePatternsFile(csvFile(",Demand,1:00,1"), labels);

    expect(result.status).toEqual("partial");
    expect(result.patterns).toEqual([]);
    expect(result.errors).toEqual([
      { message: "patterns.import.missingLabel", row: 2 },
    ]);
  });

  it("errors on an unsupported extension", async () => {
    const result = await parsePatternsFile(
      new File(["whatever"], "patterns.txt"),
      labels,
    );

    expect(result.status).toEqual("error");
    expect(result.errors).toEqual([
      { message: "patterns.import.unsupportedFormat" },
    ]);
  });

  it("round-trips an XLSX written by the exporter", async () => {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Pattern name", "Type", "Interval", "Multipliers"],
        ["PAT1", "Demand", "1:00", 0.8, 1.2],
      ]),
      "Patterns",
    );
    const bytes = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    }) as ArrayBuffer;

    const result = await parsePatternsFile(
      new File([bytes], "patterns.xlsx"),
      labels,
    );

    expect(result.format).toEqual("xlsx");
    expect(result.patterns).toEqual([
      {
        label: "PAT1",
        type: "demand",
        intervalSeconds: 3600,
        multipliers: [0.8, 1.2],
      },
    ]);
  });
});
