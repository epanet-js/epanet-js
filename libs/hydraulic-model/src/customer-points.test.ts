import { describe, it, expect } from "vitest";
import { CustomerPoint } from "./customer-points";

const buildCustomerPoint = (label = "CP1") =>
  new CustomerPoint(1, [10, 20], { label });

describe("CustomerPoint property bag", () => {
  it("exposes label through the property bag", () => {
    const cp = buildCustomerPoint("CP1");

    expect(cp.label).toBe("CP1");
    expect(cp.getProperty("label")).toBe("CP1");
    expect(cp.hasProperty("label")).toBe(true);
    expect(cp.listProperties()).toContain("label");
  });

  it("sets and reads arbitrary properties", () => {
    const cp = buildCustomerPoint();

    cp.setProperty("custom-1", "north");
    expect(cp.getProperty("custom-1")).toBe("north");
    expect(cp.hasProperty("custom-1")).toBe(true);
    expect(cp.hasProperty("custom-2")).toBe(false);
  });

  it("copies the bag and coordinates without sharing references", () => {
    const cp = buildCustomerPoint("CP1");
    cp.setProperty("custom-1", 42);

    const copy = cp.copy();
    copy.setProperty("label", "CP2");
    copy.setProperty("custom-1", 99);

    expect(copy.label).toBe("CP2");
    expect(copy.getProperty("custom-1")).toBe(99);
    expect(cp.label).toBe("CP1");
    expect(cp.getProperty("custom-1")).toBe(42);
  });

  it("preserves the connection on copy", () => {
    const cp = buildCustomerPoint();
    cp.connect({ pipeId: 5, junctionId: 6, snapPoint: [1, 2] });

    const copy = cp.copy();

    expect(copy.connection).toEqual({
      pipeId: 5,
      junctionId: 6,
      snapPoint: [1, 2],
    });
    expect(copy.snapPosition).toEqual([1, 2]);
  });
});
