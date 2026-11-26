import { checkSensorTimes } from "./check-sensor-timing";

const HOUR = 3600;

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
