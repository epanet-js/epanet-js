import { readingsStepSeconds } from "./time-points";

const HOUR = 3600;

describe("readingsStepSeconds", () => {
  it("places each reading on a report step of the simulation", () => {
    expect(
      readingsStepSeconds({ duration: 24 * HOUR, reportTimestep: HOUR / 4 }),
    ).toEqual(HOUR / 4);
  });

  it("falls back to one hour in steady state", () => {
    expect(
      readingsStepSeconds({ duration: 0, reportTimestep: HOUR / 4 }),
    ).toEqual(HOUR);
  });
});
