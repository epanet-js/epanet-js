import { LabelManager } from "@epanet-js/hydraulic-model";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { parseSensorDataFile } from "./parse-sensor-data-file";
import type { SensorVocabulary } from "./parameters";

const csvFile = (...lines: string[]) =>
  new File([lines.join("\n")], "sensors.csv", { type: "text/csv" });

const IDS = { J1: 1, J2: 2, P1: 3, PU1: 4, T1: 5 } as const;

const buildModel = () => {
  const labelManager = new LabelManager();
  const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
    .aJunction(IDS.J1, { label: "J1" })
    .aJunction(IDS.J2, { label: "J2" })
    .aPipe(IDS.P1, { label: "P1", startNodeId: IDS.J1, endNodeId: IDS.J2 })
    .aPump(IDS.PU1, { label: "J2", startNodeId: IDS.J1, endNodeId: IDS.J2 })
    .aTank(IDS.T1, { label: "T1" })
    .build();
  return { labelManager, assets: hydraulicModel.assets };
};

const parse = (file: File) => parseSensorDataFile(file, buildModel());

describe("parseSensorDataFile", () => {
  it("reads one sensor per column with the readings down the column", async () => {
    const result = await parse(
      csvFile(
        "sensor,SENSOR-A,SENSOR-B",
        "parameter,pressure,flow",
        "asset,J1,P1",
        "2026-03-01 00:00,50,10",
        "2026-03-01 01:00,51.5,11",
        "2026-03-01 02:00,52,12",
      ),
    );

    expect(result.status).toEqual("success");
    expect(result.format).toEqual("csv");
    expect(result.sensors).toEqual([
      {
        name: "SENSOR-A",
        parameter: "pressure",
        assetId: IDS.J1,
        readings: [50, 51.5, 52],
      },
      {
        name: "SENSOR-B",
        parameter: "flow",
        assetId: IDS.P1,
        readings: [10, 11, 12],
      },
    ]);
  });

  it("reads the header rows in any order and regardless of case", async () => {
    const result = await parse(
      csvFile("Asset,t1", "SENSOR,SENSOR-A", "Parameter,NETFLOW", "x,5"),
    );

    expect(result.sensors[0]).toMatchObject({
      name: "SENSOR-A",
      parameter: "netFlow",
      assetId: IDS.T1,
    });
  });

  it("does not read the time column", async () => {
    const result = await parse(
      csvFile(
        "sensor,SENSOR-A",
        "parameter,pressure",
        "asset,J1",
        "not a time,1",
        ",2",
      ),
    );

    expect(result.sensors[0].readings).toEqual([1, 2]);
  });

  it("reads numeric labels in the header rows as labels", async () => {
    const labelManager = new LabelManager();
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { label: "10" })
      .build();

    const result = await parseSensorDataFile(
      csvFile("sensor,20", "parameter,pressure", "asset,10", "t,1"),
      { labelManager, assets: hydraulicModel.assets },
    );

    expect(result.sensors).toEqual([
      { name: "20", parameter: "pressure", assetId: IDS.J1, readings: [1] },
    ]);
  });

  it("uses the sensor name as the asset label when there is no asset row", async () => {
    const result = await parse(
      csvFile("sensor,J1,P1", "parameter,pressure,flow", "asset,,", "t,1,2"),
    );

    expect(result.sensors.map((s) => s.assetId)).toEqual([IDS.J1, IDS.P1]);
  });

  it("ignores an unknown row above the readings with a warning", async () => {
    const result = await parse(
      csvFile(
        "sensor,SENSOR-A",
        "description,Inlet pressure",
        "parameter,pressure",
        "asset,J1",
        "t,1",
      ),
    );

    expect(result.status).toEqual("partial");
    expect(result.sensors.map((s) => s.name)).toEqual(["SENSOR-A"]);
    expect(result.errors).toEqual([{ code: "unknownHeaderRow" }]);
  });

  it("uses the first of a repeated header row", async () => {
    const result = await parse(
      csvFile(
        "sensor,SENSOR-A",
        "parameter,pressure",
        "parameter,flow",
        "asset,J1",
        "t,1",
      ),
    );

    expect(result.sensors[0].parameter).toEqual("pressure");
    expect(result.errors).toEqual([{ code: "repeatedHeaderRow" }]);
  });

  describe("vocabulary", () => {
    const vocabulary: SensorVocabulary = {
      parameters: {
        junction: { pressure: ["Presión"] },
        tank: { level: ["Nivel"] },
      },
      assetTypes: { junction: ["Nudo"], pump: ["Bomba"] },
    };

    it("accepts the given words for a parameter and an asset type, regardless of case", async () => {
      const result = await parseSensorDataFile(
        csvFile(
          "sensor,A,B",
          "parameter,PRESIÓN,nivel",
          "asset,J2,T1",
          "type,nudo,",
          "t,1,2",
        ),
        buildModel(),
        vocabulary,
      );

      expect(result.errors).toEqual([]);
      expect(
        result.sensors.map(({ parameter, assetId }) => ({
          parameter,
          assetId,
        })),
      ).toEqual([
        { parameter: "pressure", assetId: IDS.J2 },
        { parameter: "level", assetId: IDS.T1 },
      ]);
    });

    it("keeps accepting the keys alongside the given words", async () => {
      const result = await parseSensorDataFile(
        csvFile(
          "sensor,A",
          "parameter,pressure",
          "asset,J1",
          "type,junction",
          "t,1",
        ),
        buildModel(),
        vocabulary,
      );

      expect(result.sensors.map((s) => s.parameter)).toEqual(["pressure"]);
    });

    it("does not accept a word given for another asset type", async () => {
      const result = await parseSensorDataFile(
        csvFile("sensor,A", "parameter,Nivel", "asset,J1", "t,1"),
        buildModel(),
        vocabulary,
      );

      expect(result.errors).toEqual([
        { label: "A", code: "unsupportedParameter", value: "Nivel", row: 2 },
      ]);
    });
  });

  describe("asset type", () => {
    it("picks the asset of that type when a node and a link share a label", async () => {
      const result = await parse(
        csvFile(
          "sensor,A,B",
          "parameter,head,head",
          "asset,J2,J2",
          "type,Junction,pump",
          "t,1,2",
        ),
      );

      expect(result.sensors.map((s) => s.assetId)).toEqual([IDS.J2, IDS.PU1]);
    });

    it("skips a sensor whose label has no asset of that type", async () => {
      const result = await parse(
        csvFile(
          "sensor,A,B",
          "parameter,pressure,flow",
          "asset,J1,P1",
          "type,tank,pipe",
          "t,1,2",
        ),
      );

      expect(result.sensors.map((s) => s.name)).toEqual(["B"]);
      expect(result.errors).toEqual([
        { label: "A", code: "assetTypeMismatch", value: "J1", row: 2 },
      ]);
    });

    it("ignores an unknown asset type with a warning and still imports", async () => {
      const result = await parse(
        csvFile(
          "sensor,A",
          "parameter,pressure",
          "asset,J1",
          "type,hydrant",
          "t,1",
        ),
      );

      expect(result.sensors.map((s) => s.assetId)).toEqual([IDS.J1]);
      expect(result.errors).toEqual([
        { label: "A", code: "invalidAssetType", value: "hydrant", row: 2 },
      ]);
    });
  });

  describe("readings", () => {
    it("reads decimal commas and thousands separators", async () => {
      const result = await parse(
        csvFile(
          "sensor,A",
          "parameter,flow",
          "asset,P1",
          't,"51,5"',
          't,"1,234.5"',
          "t,-0.25",
        ),
      );

      expect(result.sensors[0].readings).toEqual([51.5, 1234.5, -0.25]);
    });

    it("ignores trailing blank cells at the end of a column", async () => {
      const result = await parse(
        csvFile(
          "sensor,A,B",
          "parameter,pressure,flow",
          "asset,J1,P1",
          "t,1,1",
          "t,2,",
        ),
      );

      expect(result.sensors.map((s) => s.readings)).toEqual([[1, 2], [1]]);
    });

    it("skips a sensor with a blank between readings", async () => {
      const result = await parse(
        csvFile(
          "sensor,A,B",
          "parameter,pressure,flow",
          "asset,J1,P1",
          "t,1,1",
          "t,,2",
          "t,3,3",
        ),
      );

      expect(result.sensors.map((s) => s.name)).toEqual(["B"]);
      expect(result.errors).toEqual([
        { label: "A", code: "invalidReading", value: "", row: 2 },
      ]);
    });

    it("skips a sensor with a reading that is not a number", async () => {
      const result = await parse(
        csvFile(
          "sensor,A,B",
          "parameter,pressure,flow",
          "asset,J1,P1",
          "t,1,1",
          "t,high,2",
        ),
      );

      expect(result.errors).toEqual([
        { label: "A", code: "invalidReading", value: "high", row: 2 },
      ]);
    });

    it("skips a sensor with no readings", async () => {
      const result = await parse(
        csvFile(
          "sensor,A,B,C",
          "parameter,pressure,flow,head",
          "asset,J1,P1,J1",
          "t,,1,1",
        ),
      );

      expect(result.errors).toEqual([
        { label: "A", code: "noReadings", row: 2 },
      ]);
    });
  });

  describe("skipped sensors", () => {
    it("skips a column with readings but no sensor name", async () => {
      const result = await parse(
        csvFile(
          "sensor,,B,C",
          "parameter,pressure,flow,head",
          "asset,J1,P1,J1",
          "t,1,1,1",
        ),
      );

      expect(result.status).toEqual("partial");
      expect(result.errors).toEqual([{ code: "missingName", row: 2 }]);
    });

    it("keeps the first column of a repeated sensor name and reports it once", async () => {
      const result = await parse(
        csvFile(
          "sensor,SENSOR-A,sensor-a,SENSOR-A",
          "parameter,pressure,head,flow",
          "asset,J1,J1,P1",
          "t,1,2,3",
        ),
      );

      expect(result.sensors.map((s) => s.parameter)).toEqual(["pressure"]);
      expect(result.errors).toEqual([
        { label: "sensor-a", code: "duplicateName", row: 3 },
      ]);
      expect(result.ignored).toEqual(2);
    });

    it("skips a sensor whose asset is not in the model", async () => {
      const result = await parse(
        csvFile(
          "sensor,A,B",
          "parameter,pressure,flow",
          "asset,J9,P1",
          "t,1,1",
        ),
      );

      expect(result.errors).toEqual([
        { label: "A", code: "assetNotFound", value: "J9", row: 2 },
      ]);
    });

    it("skips a sensor with no parameter or one its asset does not support", async () => {
      const result = await parse(
        csvFile(
          "sensor,A,B,C,D",
          "parameter,,flow,Pressure (psi),head",
          "asset,J1,J1,J1,J1",
          "t,1,1,1,1",
        ),
      );

      expect(result.errors).toEqual([
        { label: "A", code: "missingParameter", row: 2 },
        { label: "B", code: "unsupportedParameter", value: "flow", row: 3 },
        {
          label: "C",
          code: "unsupportedParameter",
          value: "Pressure (psi)",
          row: 4,
        },
      ]);
    });

    it("resolves a label shared by a node and a link by the parameter", async () => {
      const result = await parse(
        csvFile(
          "sensor,A,B",
          "parameter,pressure,flow",
          "asset,J2,J2",
          "t,1,1",
        ),
      );

      expect(result.sensors.map((s) => s.assetId)).toEqual([IDS.J2, IDS.PU1]);
    });

    it("skips a sensor whose parameter fits both assets sharing its label", async () => {
      const result = await parse(
        csvFile("sensor,A,B", "parameter,head,flow", "asset,J2,P1", "t,1,1"),
      );

      expect(result.errors).toEqual([
        { label: "A", code: "ambiguousAsset", value: "J2", row: 2 },
      ]);
    });

    it("skips a second sensor for the same parameter on one asset", async () => {
      const result = await parse(
        csvFile(
          "sensor,A,B,C",
          "parameter,pressure,head,pressure",
          "asset,J1,J1,j1",
          "t,1,1,2",
        ),
      );

      expect(result.sensors.map((s) => s.name)).toEqual(["A", "B"]);
      expect(result.errors).toEqual([
        { label: "C", code: "duplicateSensorOnAsset", row: 4 },
      ]);
    });
  });

  describe("refused files", () => {
    it("refuses a format other than CSV or XLSX", async () => {
      const result = await parse(new File(["x"], "sensors.txt"));

      expect(result.status).toEqual("error");
      expect(result.errors).toEqual([{ code: "unsupportedFormat" }]);
    });

    it("refuses a file without a sensor row", async () => {
      const result = await parse(
        csvFile("Sensor name,Type,Asset label,Readings", "A,pressure,J1,1"),
      );

      expect(result.status).toEqual("error");
      expect(result.errors).toEqual([{ code: "notAValidSensorFile" }]);
    });

    it("refuses a file whose columns are mostly not sensors", async () => {
      const result = await parse(
        csvFile(
          "sensor,A,B,C",
          "parameter,pressure,flow,head",
          "asset,J1,P1,J1",
          "t,,later,1",
        ),
      );

      expect(result.status).toEqual("error");
      expect(result.sensors).toEqual([]);
      expect(result.errors).toEqual([{ code: "notAValidSensorFile" }]);
    });

    it("refuses a file with no sensor columns", async () => {
      const result = await parse(csvFile("sensor", "parameter", "t"));

      expect(result.errors).toEqual([{ code: "notAValidSensorFile" }]);
    });

    it("reports the reasons when no asset is found, rather than refusing", async () => {
      const result = await parse(
        csvFile(
          "sensor,A,B",
          "parameter,pressure,flow",
          "asset,X1,X2",
          "t,1,1",
        ),
      );

      expect(result.status).toEqual("error");
      expect(result.errors.map((e) => e.code)).toEqual([
        "assetNotFound",
        "assetNotFound",
      ]);
      expect(result.ignored).toEqual(2);
    });
  });

  it("reads an XLSX file", async () => {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["sensor", "SENSOR-A"],
        ["parameter", "pressure"],
        ["asset", "J1"],
        [new Date(Date.UTC(2026, 2, 1)), 50],
        [new Date(Date.UTC(2026, 2, 1, 1)), 51],
      ]),
      "Sensors",
    );
    const bytes = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    }) as ArrayBuffer;

    const result = await parse(new File([bytes], "sensors.xlsx"));

    expect(result.format).toEqual("xlsx");
    expect(result.sensors).toEqual([
      {
        name: "SENSOR-A",
        parameter: "pressure",
        assetId: IDS.J1,
        readings: [50, 51],
      },
    ]);
  });
});
