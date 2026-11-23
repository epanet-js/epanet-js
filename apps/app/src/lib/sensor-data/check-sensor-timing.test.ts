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
