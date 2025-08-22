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

  it("copies customer point without connection", () => {
    const originalPoint = buildCustomerPoint("CP1", {
      coordinates: [10, 20],
      demand: 50,
    });

    const copiedPoint = originalPoint.copyDisconnected();

    expect(copiedPoint.id).toBe(originalPoint.id);
    expect(copiedPoint.coordinates).toEqual(originalPoint.coordinates);
    expect(copiedPoint.baseDemand).toBe(originalPoint.baseDemand);
    expect(copiedPoint.connection).toBeNull();

    expect(copiedPoint.coordinates).not.toBe(originalPoint.coordinates);

    copiedPoint.coordinates[0] = 99;
    expect(originalPoint.coordinates[0]).toBe(10);
  });

  it("does not preserve connection data when copying", () => {
    const originalPoint = buildCustomerPoint("CP1", {
      coordinates: [10, 20],
      demand: 50,
    });

    const connection = {
      pipeId: "P1",
      snapPoint: [15, 25] as [number, number],
      distance: 7.5,
      junctionId: "J1",
    };

    originalPoint.connect(connection);
    const copiedPoint = originalPoint.copyDisconnected();

    expect(originalPoint.connection).not.toBeNull();
    expect(copiedPoint.connection).toBeNull();
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
