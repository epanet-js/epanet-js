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
    expect(checkSensorTiming([aSensor("A", 19)], timing)).toEqual([]);
  });

  it("warns when the readings run past the duration or cover less than three quarters of it", () => {
    const warnings = checkSensorTiming(
      [aSensor("SHORT", 18), aSensor("LONG", 26)],
      timing,
    );

    expect(warnings).toEqual([
      {
        label: "SHORT",
        code: "readingsDontCoverDuration",
        params: ["25", "18"],
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

const aTimedSensor = (name: string, column: number, times: number[]) => ({
  name,
  column,
  times,
});

const parsed = (...sensors: ReturnType<typeof aTimedSensor>[]) => ({
  sensors,
  columns: new Map(sensors.map(({ name, column }) => [name, column])),
});

describe("checkSensorTimes", () => {
  const timing = { duration: 24 * HOUR, reportTimestep: HOUR / 4 };

  it("accepts readings from the start to the end of the duration", () => {
    expect(
      checkSensorTimes(
        parsed(aTimedSensor("A", 2, [0, 7 * HOUR, 24 * HOUR])),
        timing,
      ),
    ).toEqual([]);
  });

  it("accepts readings that run past the duration", () => {
    expect(
      checkSensorTimes(parsed(aTimedSensor("A", 2, [0, 48 * HOUR])), timing),
    ).toEqual([]);
  });

  it("accepts readings that start after the start of the simulation", () => {
    expect(
      checkSensorTimes(
        parsed(aTimedSensor("A", 2, [4 * HOUR, 24 * HOUR])),
        timing,
      ),
    ).toEqual([]);
  });

  it("accepts readings that end at or after three quarters of the simulation", () => {
    expect(
      checkSensorTimes(
        parsed(
          aTimedSensor("THREE_QUARTERS", 2, [0, 18 * HOUR]),
          aTimedSensor("MOST", 3, [0, 20 * HOUR]),
        ),
        timing,
      ),
    ).toEqual([]);
  });

  it("warns at the column of each sensor whose readings end before three quarters of the simulation", () => {
    const warnings = checkSensorTimes(
      parsed(
        aTimedSensor("SHORT", 2, [0, 17 * HOUR]),
        aTimedSensor("FULL", 3, [0, 24 * HOUR]),
        aTimedSensor("STOPPED", 5, [0, 2 * HOUR]),
      ),
      timing,
    );

    expect(warnings).toEqual([
      { label: "SHORT", code: "readingsEndEarly", column: 2 },
      { label: "STOPPED", code: "readingsEndEarly", column: 5 },
    ]);
  });

  it("gives no warnings in steady state", () => {
    expect(
      checkSensorTimes(parsed(aTimedSensor("A", 2, [HOUR])), { duration: 0 }),
    ).toEqual([]);
  });
});
