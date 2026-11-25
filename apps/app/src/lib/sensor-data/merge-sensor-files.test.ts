import { mergeSensorFiles, type SensorFile } from "./merge-sensor-files";
import type { ImportedSensor } from "./parse-sensor-data-file";

const HOUR = 3600;

const aSensor = (
  name: string,
  times: number[],
  overrides: Partial<ImportedSensor> = {},
): ImportedSensor => ({
  name,
  parameter: "pressure",
  assetId: 1,
  times,
  readings: times.map((time) => time / HOUR),
  ...overrides,
});

const aFile = (name: string, ...sensors: ImportedSensor[]): SensorFile => ({
  name,
  result: {
    sensors,
    columns: new Map(sensors.map((sensor, index) => [sensor.name, index + 2])),
  },
});

describe("mergeSensorFiles", () => {
  it("keeps the sensors of every file", () => {
    const north = aSensor("NORTH", [0, HOUR]);
    const south = aSensor("SOUTH", [0, HOUR], { assetId: 2 });
    const { sensors, sensorsByFile, errorsByFile } = mergeSensorFiles([
      aFile("north.csv", north),
      aFile("south.csv", south),
    ]);

    expect(sensors).toEqual([north, south]);
    expect(sensorsByFile).toEqual([[north], [south]]);
    expect(errorsByFile).toEqual([[], []]);
  });

  it("skips a sensor already read from an earlier file, naming that file, whatever its times", () => {
    const { sensors, sensorsByFile, errorsByFile, skippedByFile } =
      mergeSensorFiles([
        aFile("day-1.csv", aSensor("NORTH", [0, HOUR])),
        aFile(
          "day-2.csv",
          aSensor("SOUTH", [0], { assetId: 2 }),
          aSensor("north", [24 * HOUR, 25 * HOUR]),
        ),
      ]);

    expect(sensors.map(({ name, times }) => [name, times])).toEqual([
      ["NORTH", [0, HOUR]],
      ["SOUTH", [0]],
    ]);
    expect(sensorsByFile[1].map(({ name }) => name)).toEqual(["SOUTH"]);
    expect(errorsByFile[1]).toEqual([
      {
        label: "north",
        code: "repeatedSensor",
        params: ["day-1.csv"],
        column: 3,
      },
    ]);
    expect(skippedByFile).toEqual([new Set(), new Set(["north"])]);
  });

  it("skips a second sensor name for the same parameter on one asset", () => {
    const { sensors, errorsByFile } = mergeSensorFiles([
      aFile("day-1.csv", aSensor("NORTH", [0])),
      aFile("day-2.csv", aSensor("NORTH-2", [HOUR])),
    ]);

    expect(sensors.map(({ name }) => name)).toEqual(["NORTH"]);
    expect(errorsByFile[1]).toEqual([
      { label: "NORTH-2", code: "duplicateSensorOnAsset", column: 2 },
    ]);
  });

  it("remembers the file and column each sensor came from", () => {
    const { lastReadingIn } = mergeSensorFiles([
      aFile("day-1.csv", aSensor("NORTH", [0])),
      aFile(
        "day-2.csv",
        aSensor("SOUTH", [0], { assetId: 2 }),
        aSensor("NORTH", [HOUR]),
      ),
    ]);

    expect(lastReadingIn).toEqual(
      new Map([
        ["NORTH", { file: 0, column: 2 }],
        ["SOUTH", { file: 1, column: 2 }],
      ]),
    );
  });
});
