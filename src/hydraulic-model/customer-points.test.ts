import { createCustomerPoint, validateCustomerPoint } from "./customer-points";

describe("createCustomerPoint", () => {
  it("creates customer point with provided ID", () => {
    const customerPoint = createCustomerPoint([10, 20], { name: "Test" }, "5");

    expect(customerPoint).toEqual({
      id: "5",
      coordinates: [10, 20],
      properties: { name: "Test" },
    });
  });

  it("creates customer point with default ID when none provided", () => {
    const customerPoint = createCustomerPoint([10, 20], { name: "Test" });

    expect(customerPoint).toEqual({
      id: "1",
      coordinates: [10, 20],
      properties: { name: "Test" },
    });
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
