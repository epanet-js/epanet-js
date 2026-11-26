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

const onRows = (code: string, ...rows: number[]) =>
  rows.map((row) => ({ code, row }));

const JUNCTION_PARAMETERS = "junction: pressure, head, demand";

describe("parseSensorDataFile", () => {
  it("reads one sensor per column with the readings down the column", async () => {
    const result = await parse(
      csvFile(
        "sensor,SENSOR-A,SENSOR-B",
        "parameter,pressure,flow",
        "asset,J1,P1",
        "00:00,50,10",
        "01:00,51.5,11",
        "02:00,52,12",
      ),
    );

    expect(result.status).toEqual("success");
    expect(result.format).toEqual("csv");
    expect(result.sensors).toEqual([
      {
        name: "SENSOR-A",
        parameter: "pressure",
        assetId: IDS.J1,
        times: [0, 3600, 7200],
        readings: [50, 51.5, 52],
      },
      {
        name: "SENSOR-B",
        parameter: "flow",
        assetId: IDS.P1,
        times: [0, 3600, 7200],
        readings: [10, 11, 12],
      },
    ]);
  });

  it("records the column of each sensor it imports", async () => {
    const result = await parse(
      csvFile(
        "sensor,A,,B,C",
        "parameter,pressure,,flow,pressure",
        "asset,J1,,P1,J9",
        "00:00,50,,10,1",
      ),
    );

    expect(result.columns).toEqual(
      new Map([
        ["A", 2],
        ["B", 4],
      ]),
    );
  });

  it("reads the header rows in any order and regardless of case", async () => {
    const result = await parse(
      csvFile("Asset,t1", "SENSOR,SENSOR-A", "Parameter,NETFLOW", "0:00,5"),
    );

    expect(result.sensors[0]).toMatchObject({
      name: "SENSOR-A",
      parameter: "netFlow",
      assetId: IDS.T1,
    });
  });

  describe("times", () => {
    const timesOf = async (...times: string[]) => {
      const result = await parse(
        csvFile(
          "sensor,A",
          "parameter,pressure",
          "asset,J1",
          ...times.map((time) => `${time},1`),
        ),
      );
      return { times: result.sensors[0]?.times, errors: result.errors };
    };

    it("reads hh:mm and h:mm as time since the start of the simulation", async () => {
      const { times } = await timesOf("00:00", "0:15", "9:05", "36:30");

      expect(times).toEqual([0, 900, 9 * 3600 + 300, 36 * 3600 + 1800]);
    });

    it("keeps the seconds of hh:mm:ss and h:mm:ss", async () => {
      const { times } = await timesOf(
        "00:00:00",
        "0:15:10",
        "0:15:40",
        "25:00:05",
      );

      expect(times).toEqual([0, 910, 940, 25 * 3600 + 5]);
    });

    it("keeps the time of an ISO date and time, ignoring its timezone", async () => {
      const { times } = await timesOf(
        "2026-03-01T00:00:00Z",
        "2026-03-01T00:15:30+02:00",
        "2026-03-01 01:00",
        "2026-03-01T01:30:00.000-0500",
      );

      expect(times).toEqual([0, 930, 3600, 5400]);
    });

    it("keeps the time of a day-first date and time", async () => {
      const { times } = await timesOf(
        "01/03/2026 00:00",
        '"01/03/2026, 00:15:00"',
        "1/3/2026 1:00:30",
      );

      expect(times).toEqual([0, 900, 3630]);
    });

    it("reads a month-first date and time when a day is past the 12th", async () => {
      const { times } = await timesOf("01/31/2026 23:00", "02/01/2026 00:30");

      expect(times).toEqual([23 * 3600, 24 * 3600 + 1800]);
    });

    it("reads dates that fit either order in the one where the days follow on", async () => {
      const monthFirst = await timesOf("01/02/2026 23:00", "01/03/2026 00:00");
      const dayFirst = await timesOf("02/01/2026 23:00", "03/01/2026 00:00");

      expect(monthFirst.times).toEqual([23 * 3600, 24 * 3600]);
      expect(dayFirst.times).toEqual([23 * 3600, 24 * 3600]);
    });

    it("skips dates that are day-first in some rows and month-first in others", async () => {
      const { times, errors } = await timesOf(
        "0:00",
        "13/01/2026 01:00",
        "01/14/2026 02:00",
      );

      expect(times).toEqual([0]);
      expect(errors).toEqual(onRows("mixedDateOrder", 5, 6));
    });

    it("skips only the row of a date that fits neither order", async () => {
      const { times, errors } = await timesOf(
        "16/01/2019 00:00",
        "16/01/2019 01:00",
        "16/13/2019 02:00",
        "16/01/2019 03:00",
      );

      expect(times).toEqual([0, 3600, 3 * 3600]);
      expect(errors).toEqual(onRows("impossibleTime", 6));
    });

    it("starts the next day when a time is more than 12 hours earlier than the row above", async () => {
      const { times, errors } = await timesOf("22:00", "23:45", "0:00", "1:30");

      expect(times).toEqual([22 * 3600, 23.75 * 3600, 24 * 3600, 25.5 * 3600]);
      expect(errors).toEqual([]);
    });

    it("adds a day for every day past the date of the first row", async () => {
      const { times } = await timesOf(
        "2026-02-28 06:00",
        "2026-02-28 23:00",
        "2026-03-01 01:00",
        "2026-03-03 00:00",
      );

      expect(times).toEqual([6 * 3600, 23 * 3600, 25 * 3600, 72 * 3600]);
    });

    it("skips the rows with a missing or invalid time, with one warning per reason", async () => {
      const { times, errors } = await timesOf(
        "0:00",
        "",
        "31/02/2026 01:00",
        "15",
        "1.5",
        "1:75",
        "2:00",
      );

      expect(times).toEqual([0, 7200]);
      expect(errors).toEqual([
        ...onRows("missingTime", 5),
        ...onRows("unrecognizedTime", 7, 8, 9),
        ...onRows("impossibleTime", 6),
      ]);
    });

    it("skips the rows whose time is not later than the row above", async () => {
      const { times, errors } = await timesOf(
        "0:00",
        "1:00",
        "1:00",
        "0:30",
        "2:00",
      );

      expect(times).toEqual([0, 3600, 7200]);
      expect(errors).toEqual(onRows("timeNotIncreasing", 6, 7));
    });
  });

  it("reads numeric labels in the header rows as labels", async () => {
    const labelManager = new LabelManager();
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { label: "10" })
      .build();

    const result = await parseSensorDataFile(
      csvFile("sensor,20", "parameter,pressure", "asset,10", "0:00,1"),
      { labelManager, assets: hydraulicModel.assets },
    );

    expect(result.sensors).toEqual([
      {
        name: "20",
        parameter: "pressure",
        assetId: IDS.J1,
        times: [0],
        readings: [1],
      },
    ]);
  });

  it("uses the sensor name as the asset label when there is no asset row", async () => {
    const result = await parse(
      csvFile("sensor,J1,P1", "parameter,pressure,flow", "asset,,", "0:00,1,2"),
    );

    expect(result.sensors.map((s) => s.assetId)).toEqual([IDS.J1, IDS.P1]);
  });

  it("reads a time with no readings as the first reading row, not a header", async () => {
    const result = await parse(
      csvFile(
        "sensor,A,B",
        "parameter,pressure,pressure",
        "asset,J1,J2",
        "00:00,,",
        "01:00,50,51",
      ),
    );

    expect(result.errors).toEqual([]);
    expect(result.sensors.map(({ times }) => times)).toEqual([[3600], [3600]]);
  });

  it("reads a time above the header rows as an unknown row, not the first reading", async () => {
    const result = await parse(
      csvFile(
        "16/01/2019 10:00,",
        "sensor,A",
        "parameter,pressure",
        "asset,J1",
        "00:00,1",
        "01:00,2",
      ),
    );

    expect(result.sensors.map(({ times }) => times)).toEqual([[0, 3600]]);
    expect(result.errors).toEqual([
      {
        code: "unknownHeaderRow",
        params: ["16/01/2019 10:00", "sensor, parameter, asset, type"],
      },
    ]);
  });

  it("ignores an unknown row above the readings with a warning", async () => {
    const result = await parse(
      csvFile(
        "sensor,SENSOR-A",
        "description,Inlet pressure",
        "parameter,pressure",
        "asset,J1",
        "0:00,1",
      ),
    );

    expect(result.status).toEqual("partial");
    expect(result.sensors.map((s) => s.name)).toEqual(["SENSOR-A"]);
    expect(result.errors).toEqual([
      {
        code: "unknownHeaderRow",
        params: ["description", "sensor, parameter, asset, type"],
      },
    ]);
  });

  it("uses the first of a repeated header row", async () => {
    const result = await parse(
      csvFile(
        "sensor,SENSOR-A",
        "parameter,pressure",
        "parameter,flow",
        "asset,J1",
        "0:00,1",
      ),
    );

    expect(result.sensors[0].parameter).toEqual("pressure");
    expect(result.errors).toEqual([
      { code: "repeatedHeaderRow", params: ["parameter"] },
    ]);
  });

  describe("vocabulary", () => {
    const vocabulary: SensorVocabulary = {
      parameters: {
        junction: { pressure: ["Presión"] },
        tank: { level: ["Nivel"] },
      },
      assetTypes: { junction: ["Nudo"], pump: ["Bomba"] },
      headers: {
        sensor: ["Sensor"],
        parameter: ["Parámetro"],
        asset: ["Elemento"],
        type: ["Tipo"],
      },
    };

    it("accepts the given words for the header rows, regardless of case", async () => {
      const result = await parseSensorDataFile(
        csvFile(
          "SENSOR,A",
          "parámetro,Presión",
          "Elemento,J2",
          "tipo,Nudo",
          "0:00,1",
        ),
        buildModel(),
        vocabulary,
      );

      expect(result.errors).toEqual([]);
      expect(
        result.sensors.map(({ name, parameter }) => ({ name, parameter })),
      ).toEqual([{ name: "A", parameter: "pressure" }]);
    });

    it("lists the given words for the header rows when a row is unknown", async () => {
      const result = await parseSensorDataFile(
        csvFile(
          "sensor,A",
          "parameter,pressure",
          "asset,J2",
          "unidad,m",
          "0:00,1",
        ),
        buildModel(),
        vocabulary,
      );

      expect(result.errors).toEqual([
        {
          code: "unknownHeaderRow",
          params: [
            "unidad",
            "sensor, parameter, Parámetro, asset, Elemento, type, Tipo",
          ],
        },
      ]);
    });

    it("accepts the given words for a parameter and an asset type, regardless of case", async () => {
      const result = await parseSensorDataFile(
        csvFile(
          "sensor,A,B",
          "parameter,PRESIÓN,nivel",
          "asset,J2,T1",
          "type,nudo,",
          "0:00,1,2",
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
          "0:00,1",
        ),
        buildModel(),
        vocabulary,
      );

      expect(result.sensors.map((s) => s.parameter)).toEqual(["pressure"]);
    });

    it("does not accept a word given for another asset type", async () => {
      const result = await parseSensorDataFile(
        csvFile("sensor,A", "parameter,Nivel", "asset,J1", "0:00,1"),
        buildModel(),
        vocabulary,
      );

      expect(result.errors).toEqual([
        {
          label: "A",
          code: "unsupportedParameter",
          params: ["junction: pressure, Presión, head, demand"],
          value: "Nivel",
          column: 2,
        },
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
          "0:00,1,2",
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
          "0:00,1,2",
        ),
      );

      expect(result.sensors.map((s) => s.name)).toEqual(["B"]);
      expect(result.errors).toEqual([
        { label: "A", code: "assetTypeMismatch", value: "J1", column: 2 },
      ]);
    });

    it("ignores an unknown asset type with a warning and still imports", async () => {
      const result = await parse(
        csvFile(
          "sensor,A",
          "parameter,pressure",
          "asset,J1",
          "type,hydrant",
          "0:00,1",
        ),
      );

      expect(result.sensors.map((s) => s.assetId)).toEqual([IDS.J1]);
      expect(result.errors).toEqual([
        {
          label: "A",
          code: "invalidAssetType",
          params: ["junction, tank, reservoir, pipe, pump, valve"],
          value: "hydrant",
          column: 2,
        },
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
          '0:00,"51,5"',
          '0:01,"1,234.5"',
          "0:02,-0.25",
        ),
      );

      expect(result.sensors[0].readings).toEqual([51.5, 1234.5, -0.25]);
    });

    it("reads a blank cell as no reading at that time", async () => {
      const result = await parse(
        csvFile(
          "sensor,A,B",
          "parameter,pressure,flow",
          "asset,J1,P1",
          "0:00,1,1",
          "0:15,,2",
          "0:30,3,",
        ),
      );

      expect(
        result.sensors.map(({ times, readings }) => ({ times, readings })),
      ).toEqual([
        { times: [0, 1800], readings: [1, 3] },
        { times: [0, 900], readings: [1, 2] },
      ]);
      expect(result.errors).toEqual([]);
    });

    it("reads a reading that is not a number as no reading, with a warning", async () => {
      const result = await parse(
        csvFile(
          "sensor,A,B",
          "parameter,pressure,flow",
          "asset,J1,P1",
          "0:00,1,1",
          "0:01,high,2",
          "0:02,N/A,3",
          "0:03,4,4",
        ),
      );

      expect(result.sensors[0]).toMatchObject({
        times: [0, 180],
        readings: [1, 4],
      });
      expect(result.errors).toEqual([
        { label: "A", code: "readingNotANumber", row: 5, column: 2 },
        { label: "A", code: "readingNotANumber", row: 6, column: 2 },
      ]);
    });

    it("skips a sensor with no readings", async () => {
      const result = await parse(
        csvFile(
          "sensor,A,B,C",
          "parameter,pressure,flow,head",
          "asset,J1,P1,J1",
          "0:00,,1,1",
        ),
      );

      expect(result.errors).toEqual([
        { label: "A", code: "noReadings", column: 2 },
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
          "0:00,1,1,1",
        ),
      );

      expect(result.status).toEqual("partial");
      expect(result.errors).toEqual([{ code: "missingName", column: 2 }]);
    });

    it("keeps the first column of a repeated sensor name and reports it once", async () => {
      const result = await parse(
        csvFile(
          "sensor,SENSOR-A,sensor-a,SENSOR-A",
          "parameter,pressure,head,flow",
          "asset,J1,J1,P1",
          "0:00,1,2,3",
        ),
      );

      expect(result.sensors.map((s) => s.parameter)).toEqual(["pressure"]);
      expect(result.errors).toEqual([
        { label: "sensor-a", code: "duplicateName", column: 3 },
      ]);
      expect(result.ignored).toEqual(2);
    });

    it("skips a sensor whose asset is not in the model", async () => {
      const result = await parse(
        csvFile(
          "sensor,A,B",
          "parameter,pressure,flow",
          "asset,J9,P1",
          "0:00,1,1",
        ),
      );

      expect(result.errors).toEqual([
        { label: "A", code: "assetNotFound", value: "J9", column: 2 },
      ]);
    });

    it("skips a sensor with no parameter or one its asset does not support", async () => {
      const result = await parse(
        csvFile(
          "sensor,A,B,C,D",
          "parameter,,flow,Pressure (psi),head",
          "asset,J1,J1,J1,J1",
          "0:00,1,1,1,1",
        ),
      );

      expect(result.errors).toEqual([
        { label: "A", code: "missingParameter", column: 2 },
        {
          label: "B",
          code: "unsupportedParameter",
          params: [JUNCTION_PARAMETERS],
          value: "flow",
          column: 3,
        },
        {
          label: "C",
          code: "unsupportedParameter",
          params: [JUNCTION_PARAMETERS],
          value: "Pressure (psi)",
          column: 4,
        },
      ]);
    });

    it("resolves a label shared by a node and a link by the parameter", async () => {
      const result = await parse(
        csvFile(
          "sensor,A,B",
          "parameter,pressure,flow",
          "asset,J2,J2",
          "0:00,1,1",
        ),
      );

      expect(result.sensors.map((s) => s.assetId)).toEqual([IDS.J2, IDS.PU1]);
    });

    it("skips a sensor whose parameter fits both assets sharing its label", async () => {
      const result = await parse(
        csvFile("sensor,A,B", "parameter,head,flow", "asset,J2,P1", "0:00,1,1"),
      );

      expect(result.errors).toEqual([
        { label: "A", code: "ambiguousAsset", value: "J2", column: 2 },
      ]);
    });

    it("skips a second sensor for the same parameter on one asset", async () => {
      const result = await parse(
        csvFile(
          "sensor,A,B,C",
          "parameter,pressure,head,pressure",
          "asset,J1,J1,j1",
          "0:00,1,1,2",
        ),
      );

      expect(result.sensors.map((s) => s.name)).toEqual(["A", "B"]);
      expect(result.errors).toEqual([
        { label: "C", code: "duplicateSensorOnAsset", column: 4 },
      ]);
    });
  });

  describe("refused files", () => {
    it("refuses a format other than CSV or XLSX", async () => {
      const result = await parse(new File(["x"], "sensors.txt"));

      expect(result.status).toEqual("error");
      expect(result.errors).toEqual([{ code: "unsupportedFormat" }]);
    });

    it("refuses a file without a sensor row, naming the labels it found", async () => {
      const result = await parse(
        csvFile(
          "Sensor Id,A",
          "Type,junction",
          "Sensor Type,pressure",
          "AssetID,J1",
          "0:00,1",
        ),
      );

      expect(result.status).toEqual("error");
      expect(result.errors).toEqual([
        {
          code: "missingSensorRow",
          params: ["Sensor Id, Type, Sensor Type, AssetID"],
        },
      ]);
    });

    it("refuses a file with no header rows at all", async () => {
      const result = await parse(csvFile("0:01,2,3", "0:04,5,6"));

      expect(result.status).toEqual("error");
      expect(result.errors).toEqual([{ code: "notAValidSensorFile" }]);
    });

    it("refuses a file whose columns are mostly not sensors", async () => {
      const result = await parse(
        csvFile(
          "sensor,A,B,C",
          "parameter,pressure,flow,head",
          "asset,J1,P1,J1",
          "0:00,,later,1",
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
          "0:00,1,1",
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

  it("reads XLSX dates as the time of day plus a day per date change", async () => {
    const dateSerial = (ms: number) => ms / 86400000 + 25569;
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["sensor", "SENSOR-A"],
        ["parameter", "pressure"],
        ["asset", "J1"],
        [dateSerial(Date.UTC(2026, 2, 1, 23)), 50],
        [dateSerial(Date.UTC(2026, 2, 2, 0, 30)), 51],
      ]),
      "Sensors",
    );
    const bytes = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    }) as ArrayBuffer;

    const result = await parse(new File([bytes], "sensors.xlsx"));

    expect(result.sensors[0].times).toEqual([23 * 3600, 24 * 3600 + 1800]);
  });

  it("reads an XLSX file with times typed as clock times", async () => {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["sensor", "SENSOR-A"],
        ["parameter", "pressure"],
        ["asset", "J1"],
        [0, 50],
        [1 / 96, 51],
        [1 + 1 / 24, 52],
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
        times: [0, 900, 25 * 3600],
        readings: [50, 51, 52],
      },
    ]);
  });
});
