import { reportStepSeconds, seriesTimeRange, timeStepAt } from "./step-times";

const HOUR = 3600;

describe("reportStepSeconds", () => {
  it("uses the report step of the simulation", () => {
    expect(
      reportStepSeconds({ duration: 24 * HOUR, reportTimestep: HOUR / 4 }),
    ).toEqual(HOUR / 4);
  });

  it("falls back to one hour in steady state", () => {
    expect(
      reportStepSeconds({ duration: 0, reportTimestep: HOUR / 4 }),
    ).toEqual(HOUR);
  });
});

describe("seriesTimeRange", () => {
  it("runs from the start to the last time of any series", () => {
    expect(
      seriesTimeRange([
        { times: [0, HOUR, 2 * HOUR] },
        { times: [HOUR / 2, 90 * 60 + 30] },
        { times: [] },
      ]),
    ).toEqual({ start: 0, end: 2 * HOUR });
  });

  it("is empty without times", () => {
    expect(seriesTimeRange([{ times: [] }])).toEqual({ start: 0, end: 0 });
  });
});

describe("timeStepAt", () => {
  it("picks the nearest time step", () => {
    expect(timeStepAt(5000, 3600, 24)).toEqual(1);
    expect(timeStepAt(5500, 3600, 24)).toEqual(2);
  });

  it("finds nothing outside the run", () => {
    expect(timeStepAt(-3000, 3600, 24)).toBeNull();
    expect(timeStepAt(24 * 3600, 3600, 24)).toBeNull();
  });

  it("finds nothing without a time step", () => {
    expect(timeStepAt(0, 0, 1)).toBeNull();
  });
});
