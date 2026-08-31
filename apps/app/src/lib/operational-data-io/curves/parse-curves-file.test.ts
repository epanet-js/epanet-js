import type { CurveType } from "@epanet-js/hydraulic-model";
import { parseCurvesFile } from "./parse-curves-file";

const typeLabels: Record<CurveType, string> = {
  pump: "Pump head",
  efficiency: "Pump efficiency",
  volume: "Tank volume",
  valve: "Valve",
  headloss: "Headloss",
};

const parseOptions = {
  scope: ["volume", "valve", "headloss"] as CurveType[],
  typeLabels,
  axisLabels: { x: "X", y: "Y" },
};

const HEADER = "Curve name,Type,Axis,Values";

const csvFile = (...lines: string[]) =>
  new File([[HEADER, ...lines].join("\n")], "curves.csv", { type: "text/csv" });

const parse = (...lines: string[]) =>
  parseCurvesFile(csvFile(...lines), parseOptions);

describe("parseCurvesFile", () => {
  it("pairs the X and Y rows of a curve into points", async () => {
    const result = await parse(
      "C1,Tank volume,X,0,1.5,3",
      "C1,Tank volume,Y,0,120,260",
    );

    expect(result.status).toEqual("success");
    expect(result.curves).toEqual([
      {
        label: "C1",
        type: "volume",
        points: [
          { x: 0, y: 0 },
          { x: 1.5, y: 120 },
          { x: 3, y: 260 },
        ],
      },
    ]);
  });

  it("inherits the name and type from the row above", async () => {
    const result = await parse("C1,Tank volume,X,0,1.5", ",,Y,0,120");

    expect(result.curves).toEqual([
      {
        label: "C1",
        type: "volume",
        points: [
          { x: 0, y: 0 },
          { x: 1.5, y: 120 },
        ],
      },
    ]);
  });

  it("accepts the Y row before the X row", async () => {
    const result = await parse(
      "C1,Tank volume,Y,10,20",
      "C1,Tank volume,X,1,2",
    );

    expect(result.curves[0].points).toEqual([
      { x: 1, y: 10 },
      { x: 2, y: 20 },
    ]);
  });

  it("accepts lowercase axis values", async () => {
    const result = await parse("C1,Tank volume,x,0", "C1,Tank volume,y,1");

    expect(result.curves[0].points).toEqual([{ x: 0, y: 1 }]);
  });

  it("imports a blank type as uncategorized", async () => {
    const result = await parse("C1,,X,0", "C1,,Y,1");

    expect(result.curves[0].type).toBeUndefined();
    expect(result.status).toEqual("success");
  });

  describe("rejecting rows", () => {
    it("skips a curve with only one axis", async () => {
      const result = await parse(
        "GOOD,Tank volume,X,0",
        "GOOD,Tank volume,Y,1",
        "LONELY,Tank volume,X,0",
      );

      expect(result.status).toEqual("partial");
      expect(result.curves.map((c) => c.label)).toEqual(["GOOD"]);
      expect(result.errors).toEqual([
        { label: "LONELY", message: "curves.import.unpairedAxis", row: 4 },
      ]);
    });

    it("pairs to the shorter axis and reports the mismatch", async () => {
      const result = await parse(
        "C1,Tank volume,X,0,1,2",
        "C1,Tank volume,Y,10,20",
      );

      expect(result.curves[0].points).toEqual([
        { x: 0, y: 10 },
        { x: 1, y: 20 },
      ]);
      expect(result.errors[0].message).toEqual(
        "curves.import.axisLengthMismatch",
      );
    });

    it("skips a row whose axis is not X or Y", async () => {
      const result = await parse(
        "GOOD,Tank volume,X,0",
        "GOOD,Tank volume,Y,1",
        "BAD,Tank volume,Z,0",
      );

      expect(result.curves.map((c) => c.label)).toEqual(["GOOD"]);
      expect(result.errors[0].message).toEqual("curves.import.invalidAxis");
    });

    it("skips a curve with a non-numeric value", async () => {
      const result = await parse(
        "GOOD,Tank volume,X,0",
        "GOOD,Tank volume,Y,1",
        "BAD,Tank volume,X,oops",
        "BAD,Tank volume,Y,1",
      );

      expect(result.curves.map((c) => c.label)).toEqual(["GOOD"]);
      expect(result.errors.map((e) => e.message)).toContain(
        "curves.import.invalidValue",
      );
    });

    it("skips a curve with a gap between its values", async () => {
      const result = await parse(
        "GOOD,Tank volume,X,0",
        "GOOD,Tank volume,Y,1",
        "GAPPED,Tank volume,X,0,,2",
        "GAPPED,Tank volume,Y,1,2,3",
      );

      expect(result.curves.map((c) => c.label)).toEqual(["GOOD"]);
      expect(result.errors.map((e) => e.message)).toContain(
        "curves.import.missingValue",
      );
    });

    it("ignores a curve whose two rows give different types", async () => {
      const result = await parse(
        "GOOD,Tank volume,X,0",
        "GOOD,Tank volume,Y,1",
        "CLASH,Tank volume,X,0",
        "CLASH,Valve,Y,1",
      );

      expect(result.status).toEqual("partial");
      expect(result.curves.map((c) => c.label)).toEqual(["GOOD"]);
      expect(result.errors).toEqual([
        { label: "CLASH", message: "curves.import.conflictingTypes", row: 5 },
      ]);
    });

    it("accepts a blank type on one of the two rows", async () => {
      const result = await parse("C1,Tank volume,X,0", "C1,,Y,1");

      expect(result.status).toEqual("success");
      expect(result.curves[0].type).toEqual("volume");
    });

    it("ignores a curve belonging to the other library", async () => {
      const result = await parse(
        "TANK,Tank volume,X,0",
        "TANK,Tank volume,Y,1",
        "P1,Pump head,X,0",
        "P1,Pump head,Y,50",
      );

      expect(result.status).toEqual("partial");
      expect(result.curves.map((c) => c.label)).toEqual(["TANK"]);
      expect(result.errors).toEqual([
        { label: "P1", message: "curves.import.wrongDialog", row: 4 },
      ]);
      expect(result.ignored).toEqual(2);
    });

    it("accepts a curve the other library owns when that is the scope", async () => {
      const result = await parseCurvesFile(
        csvFile("P1,Pump head,X,0", "P1,Pump head,Y,50"),
        { ...parseOptions, scope: ["pump", "efficiency"] },
      );

      expect(result.status).toEqual("success");
      expect(result.curves.map((c) => c.label)).toEqual(["P1"]);
    });
  });

  describe("rejecting files that are not curves", () => {
    it("rejects a patterns export", async () => {
      const result = await parse(
        "PAT1,Demand,1:00,0.8,1.2",
        "PAT2,Demand,1:00,1,1.1",
      );

      expect(result.status).toEqual("error");
      expect(result.errors).toEqual([
        { message: "curves.import.notAValidCurvesFile" },
      ]);
      expect(result.curves).toEqual([]);
    });

    it("keeps a file where a minority of rows are malformed", async () => {
      const result = await parse(
        "A,Tank volume,X,0",
        "A,Tank volume,Y,1",
        "B,Tank volume,X,0",
        "B,Tank volume,Y,1",
        "C,Tank volume,X,0",
      );

      expect(result.status).toEqual("partial");
      expect(result.curves.map((c) => c.label)).toEqual(["A", "B"]);
    });

    it("errors on an unsupported extension", async () => {
      const result = await parseCurvesFile(
        new File(["whatever"], "curves.txt"),
        parseOptions,
      );

      expect(result.errors).toEqual([
        { message: "curves.import.unsupportedFormat" },
      ]);
    });
  });

  describe("header detection", () => {
    it("keeps the first row when the header is missing", async () => {
      const result = await parseCurvesFile(
        new File(["C1,Tank volume,X,0\nC1,Tank volume,Y,1"], "curves.csv"),
        parseOptions,
      );

      expect(result.curves.map((c) => c.label)).toEqual(["C1"]);
    });

    it("numbers rows by their real position in the file", async () => {
      const result = await parse(
        "A,Tank volume,X,0",
        "A,Tank volume,Y,1",
        "B,Tank volume,X,0",
        "B,Tank volume,Y,1",
        "LONELY,Tank volume,X,0",
      );

      expect(result.errors).toEqual([
        { label: "LONELY", message: "curves.import.unpairedAxis", row: 6 },
      ]);
    });
  });

  it("reads a file with only a header as nothing to import", async () => {
    const result = await parseCurvesFile(csvFile(), parseOptions);

    expect(result.status).toEqual("success");
    expect(result.curves).toEqual([]);
    expect(result.errors).toEqual([]);
  });
});
