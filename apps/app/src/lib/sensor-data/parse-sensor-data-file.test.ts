import { LabelManager } from "@epanet-js/hydraulic-model";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { parseSensorDataFile } from "./parse-sensor-data-file";

const HEADER = "Sensor name,Type,Asset label,Readings";

const csvFile = (...lines: string[]) =>
  new File([[HEADER, ...lines].join("\n")], "sensors.csv", {
    type: "text/csv",
  });

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
  it("reads one sensor per row with the readings along the row", async () => {
    const result = await parse(
      csvFile("SENSOR-A,pressure,J1,50,51.5,52", "SENSOR-B,flow,P1,10"),
    );

    expect(result.status).toEqual("success");
    expect(result.format).toEqual("csv");
    expect(result.sensors).toEqual([
      {
        name: "SENSOR-A",
        type: "pressure",
        assetId: IDS.J1,
        readings: [50, 51.5, 52],
      },
      { name: "SENSOR-B", type: "flow", assetId: IDS.P1, readings: [10] },
    ]);
  });

  it("reads a file without a header row", async () => {
    const file = new File(["SENSOR-A,pressure,J1,50"], "sensors.csv");

    const result = await parse(file);

    expect(result.sensors.map((s) => s.name)).toEqual(["SENSOR-A"]);
  });

  it("matches the asset label and the sensor type regardless of case", async () => {
    const result = await parse(csvFile("SENSOR-A,NETFLOW,t1,5"));

    expect(result.sensors[0]).toMatchObject({
      type: "netFlow",
      assetId: IDS.T1,
    });
  });

  describe("readings", () => {
    it("reads decimal commas and thousands separators", async () => {
      const result = await parse(
        csvFile('SENSOR-A,flow,P1,"51,5","1,234.5",-0.25'),
      );

      expect(result.sensors[0].readings).toEqual([51.5, 1234.5, -0.25]);
    });

    it("ignores trailing blank cells", async () => {
      const result = await parse(csvFile("SENSOR-A,pressure,J1,1,2,,"));

      expect(result.sensors[0].readings).toEqual([1, 2]);
    });

    it("skips a sensor with a blank between readings", async () => {
      const result = await parse(csvFile("A,pressure,J1,1,,3", "B,flow,P1,1"));

      expect(result.sensors.map((s) => s.name)).toEqual(["B"]);
      expect(result.errors).toEqual([
        { label: "A", code: "invalidReading", value: "", row: 2 },
      ]);
    });

    it("skips a sensor with a reading that is not a number", async () => {
      const result = await parse(
        csvFile("A,pressure,J1,1,high", "B,flow,P1,1"),
      );

      expect(result.errors).toEqual([
        { label: "A", code: "invalidReading", value: "high", row: 2 },
      ]);
    });

    it("skips a sensor with no readings", async () => {
      const result = await parse(
        csvFile("A,pressure,J1", "B,flow,P1,1", "C,head,J1,1"),
      );

      expect(result.errors).toEqual([
        { label: "A", code: "noReadings", row: 2 },
      ]);
    });
  });

  describe("skipped sensors", () => {
    it("skips a row with no sensor name", async () => {
      const result = await parse(
        csvFile(",pressure,J1,1", "B,flow,P1,1", "C,head,J1,1"),
      );

      expect(result.status).toEqual("partial");
      expect(result.errors).toEqual([{ code: "missingName", row: 2 }]);
    });

    it("keeps the first row of a repeated sensor name and reports it once", async () => {
      const result = await parse(
        csvFile(
          "SENSOR-A,pressure,J1,1",
          "sensor-a,head,J1,2",
          "SENSOR-A,flow,P1,3",
        ),
      );

      expect(result.sensors.map((s) => s.type)).toEqual(["pressure"]);
      expect(result.errors).toEqual([
        { label: "sensor-a", code: "duplicateName", row: 3 },
      ]);
      expect(result.ignored).toEqual(2);
    });

    it("skips a sensor with no asset label or an unknown one", async () => {
      const result = await parse(
        csvFile("A,pressure,,1", "B,pressure,J9,1", "C,flow,P1,1"),
      );

      expect(result.errors).toEqual([
        { label: "A", code: "missingAsset", row: 2 },
        { label: "B", code: "assetNotFound", value: "J9", row: 3 },
      ]);
    });

    it("skips a sensor with no type or one its asset does not support", async () => {
      const result = await parse(
        csvFile(
          "A,,J1,1",
          "B,flow,J1,1",
          "C,Pressure (psi),J1,1",
          "D,head,J1,1",
        ),
      );

      expect(result.errors).toEqual([
        { label: "A", code: "missingType", row: 2 },
        { label: "B", code: "unsupportedType", value: "flow", row: 3 },
        {
          label: "C",
          code: "unsupportedType",
          value: "Pressure (psi)",
          row: 4,
        },
      ]);
    });

    it("resolves a label shared by a node and a link by the sensor type", async () => {
      const result = await parse(csvFile("A,pressure,J2,1", "B,flow,J2,1"));

      expect(result.sensors.map((s) => s.assetId)).toEqual([IDS.J2, IDS.PU1]);
    });

    it("skips a sensor whose type fits both assets sharing its label", async () => {
      const result = await parse(csvFile("A,head,J2,1", "B,flow,P1,1"));

      expect(result.errors).toEqual([
        { label: "A", code: "ambiguousAsset", value: "J2", row: 2 },
      ]);
    });

    it("skips a second sensor of the same type on one asset", async () => {
      const result = await parse(
        csvFile("A,pressure,J1,1", "B,head,J1,1", "C,pressure,j1,2"),
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

    it("refuses a file whose rows are mostly not sensors", async () => {
      const result = await parse(
        csvFile("A,pressure,J1", "B,flow,P1,later", "C,head,J1,1"),
      );

      expect(result.status).toEqual("error");
      expect(result.sensors).toEqual([]);
      expect(result.errors).toEqual([{ code: "notAValidSensorFile" }]);
    });

    it("refuses a file with no data rows", async () => {
      const result = await parse(csvFile());

      expect(result.errors).toEqual([{ code: "notAValidSensorFile" }]);
    });

    it("reports the reasons when no asset is found, rather than refusing", async () => {
      const result = await parse(csvFile("A,pressure,X1,1", "B,flow,X2,1"));

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
        ["Sensor name", "Type", "Asset label", "Readings"],
        ["SENSOR-A", "pressure", "J1", 50, 51],
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
        type: "pressure",
        assetId: IDS.J1,
        readings: [50, 51],
      },
    ]);
  });
});
