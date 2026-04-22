import { createEmptyControls } from "src/hydraulic-model/controls";
import { serializeControls } from "./set-all-controls";

describe("serializeControls", () => {
  it("produces a JSON string that round-trips through JSON.parse", () => {
    const IDS = { A1: 1, A2: 2 } as const;
    const controls = {
      simple: [
        {
          template: "LINK {{0}} OPEN IF NODE {{1}} BELOW 5",
          assetReferences: [
            { assetId: IDS.A1, isActionTarget: true },
            { assetId: IDS.A2, isActionTarget: false },
          ],
        },
      ],
      rules: [
        {
          ruleId: "R1",
          template: "RULE R1",
          assetReferences: [{ assetId: IDS.A2, isActionTarget: false }],
        },
      ],
    };

    const data = serializeControls(controls);

    expect(JSON.parse(data)).toEqual(controls);
  });

  it("serializes empty controls as empty arrays", () => {
    const data = serializeControls(createEmptyControls());
    expect(JSON.parse(data)).toEqual({ simple: [], rules: [] });
  });

  it("throws when the in-memory shape is malformed", () => {
    expect(() =>
      serializeControls({
        simple: [
          {
            assetReferences: [],
          } as unknown as {
            template: string;
            assetReferences: never[];
          },
        ],
        rules: [],
      }),
    ).toThrow(/Controls: data does not match schema/);
  });
});
