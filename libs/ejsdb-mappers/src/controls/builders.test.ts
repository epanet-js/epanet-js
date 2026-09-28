import { buildControlsData } from "./builders";

describe("buildControlsData", () => {
  it("reconstructs controls from the serialized blob", () => {
    const IDS = { P1: 7 } as const;

    const controls = buildControlsData(
      JSON.stringify([
        {
          id: "ctrl-1",
          type: "timed-setting",
          linkId: IDS.P1,
          steps: [
            { time: 3600, status: "on", setting: 1.2 },
            { time: 7200, status: "off", setting: 1.2 },
          ],
        },
      ]),
    );

    expect(controls).toHaveLength(1);
    expect(controls[0]).toEqual({
      id: "ctrl-1",
      type: "timed-setting",
      linkId: IDS.P1,
      steps: [
        { time: 3600, status: "on", setting: 1.2 },
        { time: 7200, status: "off", setting: 1.2 },
      ],
    });
  });

  it("reconstructs a level-setting control from the serialized blob", () => {
    const controls = buildControlsData(
      JSON.stringify([
        {
          id: "ctrl-1",
          type: "level-setting",
          linkId: 7,
          tankId: 12,
          on: { level: 2, setting: 1.5 },
          off: { level: 9 },
        },
      ]),
    );

    expect(controls[0]).toEqual({
      id: "ctrl-1",
      type: "level-setting",
      linkId: 7,
      tankId: 12,
      on: { level: 2, setting: 1.5 },
      off: { level: 9 },
    });
  });

  it("reconstructs a variable speed pump control from the serialized blob", () => {
    const IDS = { PU1: 7, PU2: 8, T1: 12 } as const;
    const control = {
      id: "ctrl-1",
      type: "variable-speed-pump",
      linkId: IDS.PU1,
      quantity: "level",
      targetId: IDS.T1,
      target: 4.5,
      minSpeed: 0.3,
      maxSpeed: 1,
      laggedPumpIds: [IDS.PU2],
      schedule: [
        { time: 0, target: 3 },
        { time: 21600, target: 4.5 },
      ],
    };

    const controls = buildControlsData(JSON.stringify([control]));

    expect(controls).toEqual([control]);
  });

  it("throws when a variable speed pump quantity is unknown", () => {
    expect(() =>
      buildControlsData(
        JSON.stringify([
          {
            id: "ctrl-1",
            type: "variable-speed-pump",
            linkId: 7,
            quantity: "velocity",
            targetId: 12,
            target: 1,
            minSpeed: 0.5,
            maxSpeed: 1,
            laggedPumpIds: [],
            schedule: [],
          },
        ]),
      ),
    ).toThrow(/Controls: data does not match schema/);
  });

  it("returns empty controls for null input (fresh project)", () => {
    expect(buildControlsData(null)).toEqual([]);
  });

  it("throws when the blob is not valid JSON", () => {
    expect(() => buildControlsData("not-json")).toThrow(
      /Controls: data is not valid JSON/,
    );
  });

  it("throws when a step is malformed", () => {
    expect(() =>
      buildControlsData(
        JSON.stringify([
          {
            type: "timed-setting",
            linkId: 1,
            steps: [{ time: 0, status: "on" }],
          },
        ]),
      ),
    ).toThrow(/Controls: data does not match schema/);
  });

  it("throws when a step has an invalid status", () => {
    expect(() =>
      buildControlsData(
        JSON.stringify([
          {
            type: "timed-setting",
            linkId: 1,
            steps: [{ time: 0, status: "maybe", setting: 1 }],
          },
        ]),
      ),
    ).toThrow(/Controls: data does not match schema/);
  });

  it("throws when the control type is unknown", () => {
    expect(() =>
      buildControlsData(JSON.stringify([{ type: "mystery", linkId: 1 }])),
    ).toThrow(/Controls: data does not match schema/);
  });
});
