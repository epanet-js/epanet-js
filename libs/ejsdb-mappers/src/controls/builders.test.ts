import { buildControlsData } from "./builders";

describe("buildControlsData", () => {
  it("reconstructs controls from the serialized blob", () => {
    const IDS = { P1: 7 } as const;

    const controls = buildControlsData(
      JSON.stringify([
        {
          type: "timed-setting",
          linkId: IDS.P1,
          steps: [
            { time: 0, setting: 1 },
            { time: 7200, setting: 0 },
          ],
        },
      ]),
    );

    expect(controls).toHaveLength(1);
    expect(controls[0]).toEqual({
      type: "timed-setting",
      linkId: IDS.P1,
      steps: [
        { time: 0, setting: 1 },
        { time: 7200, setting: 0 },
      ],
    });
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
          { type: "timed-setting", linkId: 1, steps: [{ time: 0 }] },
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
