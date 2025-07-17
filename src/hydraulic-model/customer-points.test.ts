import { validateCustomerPoint } from "./customer-points";
import { buildCustomerPoint } from "src/__helpers__/hydraulic-model-builder";

describe("CustomerPoint", () => {
  it("creates customer point with provided ID", () => {
    const customerPoint = buildCustomerPoint("5", {
      coordinates: [10, 20],
      demand: 100,
    });

    expect(customerPoint.id).toBe("5");
    expect(customerPoint.coordinates).toEqual([10, 20]);
    expect(customerPoint.baseDemand).toBe(100);
  });

  it("creates customer point with zero demand", () => {
    const customerPoint = buildCustomerPoint("1", { coordinates: [10, 20] });

    expect(customerPoint.id).toBe("1");
    expect(customerPoint.coordinates).toEqual([10, 20]);
    expect(customerPoint.baseDemand).toBe(0);
  });
});

describe("validateCustomerPoint", () => {
  it("validates correct customer point", () => {
    const customerPoint = {
      id: "1",
      coordinates: [10, 20],
      properties: { name: "Test" },
    };

    expect(validateCustomerPoint(customerPoint)).toBe(true);
  });

  it("rejects invalid customer point", () => {
    expect(validateCustomerPoint({})).toBe(false);
    expect(validateCustomerPoint({ id: "1" })).toBe(false);
    expect(validateCustomerPoint({ id: "1", coordinates: "invalid" })).toBe(
      false,
    );
  });
});
