import { checkSensorTimes, checkSensorTiming } from "./check-sensor-timing";

const HOUR = 3600;

const aSensor = (name: string, count: number) => ({
  name,
  readings: Array.from({ length: count }, () => 1),
});

describe("checkSensorTiming", () => {
  const timing = { duration: 24 * HOUR, reportTimestep: HOUR };

  it("accepts one reading per report step across the duration", () => {
    expect(checkSensorTiming([aSensor("A", 25)], timing)).toEqual([]);
  });

  it("accepts readings that stop short of the duration", () => {
    expect(checkSensorTiming([aSensor("A", 13)], timing)).toEqual([]);
  });

  it("warns when the readings run past the duration or cover less than half of it", () => {
    const warnings = checkSensorTiming(
      [aSensor("SHORT", 12), aSensor("LONG", 26)],
      timing,
    );

    expect(warnings).toEqual([
      {
        label: "SHORT",
        code: "readingsDontCoverDuration",
        params: ["25", "12"],
      },
      {
        label: "LONG",
        code: "readingsDontCoverDuration",
        params: ["25", "26"],
      },
    ]);
  });

  it("counts steps with the report time step", () => {
    const quarterHourly = { duration: 24 * HOUR, reportTimestep: HOUR / 4 };

    expect(checkSensorTiming([aSensor("A", 97)], quarterHourly)).toEqual([]);
    expect(checkSensorTiming([aSensor("B", 25)], quarterHourly)).toEqual([
      {
        label: "B",
        code: "readingsDontCoverDuration",
        params: ["97", "25"],
      },
    ]);
  });

  it("gives no warnings in steady state", () => {
    const warnings = checkSensorTiming([aSensor("A", 3)], {
      duration: 0,
      reportTimestep: HOUR,
    });

    expect(warnings).toEqual([]);
  });
});

const aTimedSensor = (name: string, times: number[]) => ({ name, times });

describe("checkSensorTimes", () => {
  const timing = { duration: 24 * HOUR, reportTimestep: HOUR / 4 };

  it("accepts readings from the start to the end of the duration", () => {
    expect(
      checkSensorTimes([aTimedSensor("A", [0, 7 * HOUR, 24 * HOUR])], timing),
    ).toEqual([]);
  });

  it("accepts readings that run past the duration", () => {
    expect(
      checkSensorTimes([aTimedSensor("A", [0, 48 * HOUR])], timing),
    ).toEqual([]);
  });

  it("accepts readings that start after the start of the simulation", () => {
    expect(
      checkSensorTimes([aTimedSensor("A", [4 * HOUR, 24 * HOUR])], timing),
    ).toEqual([]);
  });

  it("accepts readings that end one report step before the simulation does", () => {
    expect(
      checkSensorTimes([aTimedSensor("A", [0, 23.75 * HOUR])], timing),
    ).toEqual([]);
  });

  it("warns when the readings end before the simulation does", () => {
    const warnings = checkSensorTimes(
      [aTimedSensor("SHORT", [0, 12 * HOUR])],
      timing,
    );

    expect(warnings).toEqual([{ label: "SHORT", code: "readingsEndEarly" }]);
  });

  it("gives no warnings in steady state", () => {
    expect(
      checkSensorTimes([aTimedSensor("A", [HOUR])], {
        duration: 0,
        reportTimestep: HOUR,
      }),
    ).toEqual([]);
  });
});
