import { timeStepAt } from "./step-times";

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
