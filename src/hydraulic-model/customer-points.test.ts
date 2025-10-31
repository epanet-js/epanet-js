import { buildCustomerPoint } from "src/__helpers__/hydraulic-model-builder";

describe("CustomerPoint", () => {
  it("creates customer point with provided ID", () => {
    const IDS = { CP5: 5 };
    const customerPoint = buildCustomerPoint(IDS.CP5, {
      coordinates: [10, 20],
      demand: 100,
    });

    expect(customerPoint.id).toBe(String(IDS.CP5));
    expect(customerPoint.coordinates).toEqual([10, 20]);
    expect(customerPoint.baseDemand).toBe(100);
  });

  it("creates customer point with zero demand", () => {
    const IDS = { CP1: 1 };
    const customerPoint = buildCustomerPoint(IDS.CP1, {
      coordinates: [10, 20],
    });

    expect(customerPoint.id).toBe(String(IDS.CP1));
    expect(customerPoint.coordinates).toEqual([10, 20]);
    expect(customerPoint.baseDemand).toBe(0);
  });

  it("copies customer point without connection", () => {
    const IDS = { CP1: 1 };
    const originalPoint = buildCustomerPoint(IDS.CP1, {
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
    const IDS = { CP1: 1, P1: 2, J1: 3 };
    const originalPoint = buildCustomerPoint(IDS.CP1, {
      coordinates: [10, 20],
      demand: 50,
    });

    const connection = {
      pipeId: String(IDS.P1),
      snapPoint: [15, 25] as [number, number],
      distance: 7.5,
      junctionId: String(IDS.J1),
    };

    originalPoint.connect(connection);
    const copiedPoint = originalPoint.copyDisconnected();

    expect(originalPoint.connection).not.toBeNull();
    expect(copiedPoint.connection).toBeNull();
  });
});
