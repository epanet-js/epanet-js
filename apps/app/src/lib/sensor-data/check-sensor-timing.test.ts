import { checkSensorTiming } from "./check-sensor-timing";

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

  it("warns when the readings stop short of the duration or run past it", () => {
    const warnings = checkSensorTiming(
      [aSensor("SHORT", 13), aSensor("LONG", 49)],
      timing,
    );

    expect(warnings).toEqual([
      { label: "SHORT", code: "readingsDontCoverDuration" },
      { label: "LONG", code: "readingsDontCoverDuration" },
    ]);
  });

  it("counts steps with the report time step", () => {
    const quarterHourly = { duration: 24 * HOUR, reportTimestep: HOUR / 4 };

    expect(checkSensorTiming([aSensor("A", 97)], quarterHourly)).toEqual([]);
    expect(checkSensorTiming([aSensor("B", 25)], quarterHourly)).toEqual([
      { label: "B", code: "readingsDontCoverDuration" },
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
