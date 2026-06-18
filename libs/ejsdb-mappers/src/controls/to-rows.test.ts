import { createEmptyControls, Controls } from "@epanet-js/hydraulic-model";
import { serializeControls } from "./to-rows";

describe("serializeControls", () => {
  it("produces a JSON string that round-trips through JSON.parse", () => {
    const IDS = { P1: 7 } as const;
    const controls: Controls = [
      {
        type: "timed-setting",
        linkId: IDS.P1,
        steps: [
          { time: 3600, status: "off", setting: 1 },
          { time: 7200, status: "on", setting: 1.5 },
        ],
      },
    ];

    const data = serializeControls(controls);

    expect(JSON.parse(data)).toEqual(controls);
  });

  it("serializes empty controls as an empty array", () => {
    const data = serializeControls(createEmptyControls());
    expect(JSON.parse(data)).toEqual([]);
  });

  it("throws when the in-memory shape is malformed", () => {
    expect(() =>
      serializeControls([
        {
          type: "timed-setting",
          linkId: 1,
          steps: [{ time: 0, status: "on" }],
        } as unknown as Controls[number],
      ]),
    ).toThrow(/Controls: data does not match schema/);
  });

  it("throws when the control type is unknown", () => {
    expect(() =>
      serializeControls([
        {
          type: "mystery",
          linkId: 1,
          steps: [],
        } as unknown as Controls[number],
      ]),
    ).toThrow(/Controls: data does not match schema/);
  });
});
