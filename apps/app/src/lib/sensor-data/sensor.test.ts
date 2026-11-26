import { toStoredSensors } from "./sensor";

const anImportedSensor = (
  name: string,
  times: number[],
  readings: number[],
) => ({
  name,
  parameter: "pressure" as const,
  assetId: 1,
  times,
  readings,
});

describe("toStoredSensors", () => {
  it("gives each sensor its own id and files its readings under it", () => {
    const { sensors, readings } = toStoredSensors([
      anImportedSensor("A", [0, 900], [50, 51]),
      anImportedSensor("B", [0], [3]),
    ]);

    expect(sensors.map(({ name }) => name)).toEqual(["A", "B"]);
    expect(new Set(sensors.map(({ id }) => id)).size).toEqual(2);
    expect(readings.get(sensors[0].id)).toEqual({
      times: [0, 900],
      values: [50, 51],
    });
    expect(readings.get(sensors[1].id)).toEqual({ times: [0], values: [3] });
  });

  it("keeps the id of a sensor imported again under the same name", () => {
    const first = toStoredSensors([anImportedSensor("Tank-1", [0], [1])]);
    const second = toStoredSensors(
      [
        anImportedSensor("TANK-1", [0, 900], [2, 3]),
        anImportedSensor("NEW", [0], [4]),
      ],
      first.sensors,
    );

    const [tank, added] = second.sensors;
    expect(tank.id).toEqual(first.sensors[0].id);
    expect(second.readings.get(tank.id)).toEqual({
      times: [0, 900],
      values: [2, 3],
    });
    expect(added.id).not.toEqual(tank.id);
  });
});
