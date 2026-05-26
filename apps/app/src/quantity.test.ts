import { convertTo } from "./quantity";

describe("custom quantities", () => {
  it("can convert from and to mwc", () => {
    expect(convertTo({ value: 10, unit: "mwc" }, "psi")).toBeCloseTo(14.22);
    expect(convertTo({ value: 14.22, unit: "psi" }, "mwc")).toBeCloseTo(10);
  });
});
