import { describe, expect, it } from "vitest";
import {
  flowModulatingValvePointChecks as checks,
  getFlowModulatingValvePointErrors,
} from "./flow-modulating-valve-points";

describe("flowModulatingValvePointChecks", () => {
  const valid = [
    { flow: 0, pressure: 20 },
    { flow: 10, pressure: 25 },
    { flow: 20, pressure: 30 },
  ];

  it("accepts strictly increasing flows and pressures", () => {
    expect(checks.flowsNonNegative(valid)).toBe(true);
    expect(checks.pressuresPositive(valid)).toBe(true);
    expect(checks.flowsIncreasing(valid)).toBe(true);
    expect(checks.pressuresIncreasing(valid)).toBe(true);
  });

  it("rejects a negative flow but allows zero", () => {
    expect(checks.flowsNonNegative([{ flow: -1, pressure: 20 }])).toBe(false);
    expect(checks.flowsNonNegative([{ flow: 0, pressure: 20 }])).toBe(true);
  });

  it("rejects a zero or negative pressure", () => {
    expect(checks.pressuresPositive([{ flow: 0, pressure: 0 }])).toBe(false);
    expect(checks.pressuresPositive([{ flow: 0, pressure: -5 }])).toBe(false);
  });

  it("rejects repeated or decreasing flows", () => {
    const repeated = [
      { flow: 0, pressure: 20 },
      { flow: 10, pressure: 25 },
      { flow: 10, pressure: 30 },
    ];
    const decreasing = [
      { flow: 10, pressure: 20 },
      { flow: 5, pressure: 25 },
    ];
    expect(checks.flowsIncreasing(repeated)).toBe(false);
    expect(checks.flowsIncreasing(decreasing)).toBe(false);
  });

  it("rejects repeated or decreasing pressures", () => {
    const repeated = [
      { flow: 0, pressure: 20 },
      { flow: 10, pressure: 20 },
    ];
    const decreasing = [
      { flow: 0, pressure: 30 },
      { flow: 10, pressure: 20 },
    ];
    expect(checks.pressuresIncreasing(repeated)).toBe(false);
    expect(checks.pressuresIncreasing(decreasing)).toBe(false);
  });

  it("accepts a single point and an empty table", () => {
    for (const check of Object.values(checks)) {
      expect(check([{ flow: 0, pressure: 20 }])).toBe(true);
      expect(check([])).toBe(true);
    }
  });
});

describe("getFlowModulatingValvePointErrors", () => {
  it("reports no rows for a valid table", () => {
    const errors = getFlowModulatingValvePointErrors([
      { flow: 0, pressure: 20 },
      { flow: 10, pressure: 25 },
    ]);
    expect([...errors.flow]).toEqual([]);
    expect([...errors.pressure]).toEqual([]);
  });

  it("flags both rows of a value that does not increase", () => {
    const errors = getFlowModulatingValvePointErrors([
      { flow: 0, pressure: 20 },
      { flow: 10, pressure: 20 },
      { flow: 10, pressure: 30 },
    ]);
    expect([...errors.flow]).toEqual([1, 2]);
    expect([...errors.pressure]).toEqual([0, 1]);
  });

  it("flags a negative flow and a zero pressure", () => {
    const errors = getFlowModulatingValvePointErrors([
      { flow: -1, pressure: 0 },
      { flow: 10, pressure: 20 },
    ]);
    expect([...errors.flow]).toEqual([0]);
    expect([...errors.pressure]).toEqual([0]);
  });
});
