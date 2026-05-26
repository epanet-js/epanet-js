import { buildControlsData } from "./builders";

describe("buildControlsData", () => {
  it("reconstructs controls from the serialized blob", () => {
    const IDS = { A1: 1, A2: 2 } as const;

    const controls = buildControlsData(
      JSON.stringify({
        simple: [
          {
            template: "LINK {{0}} OPEN IF NODE {{1}} BELOW 10",
            assetReferences: [
              { assetId: IDS.A1, isActionTarget: true },
              { assetId: IDS.A2, isActionTarget: false },
            ],
          },
        ],
        rules: [
          {
            ruleId: "R1",
            template:
              "RULE R1\nIF NODE {{0}} LEVEL > 5\nTHEN LINK {{1}} STATUS = OPEN",
            assetReferences: [
              { assetId: IDS.A2, isActionTarget: false },
              { assetId: IDS.A1, isActionTarget: true },
            ],
          },
        ],
      }),
    );

    expect(controls.simple).toHaveLength(1);
    expect(controls.simple[0]).toEqual({
      template: "LINK {{0}} OPEN IF NODE {{1}} BELOW 10",
      assetReferences: [
        { assetId: IDS.A1, isActionTarget: true },
        { assetId: IDS.A2, isActionTarget: false },
      ],
    });
    expect(controls.rules).toHaveLength(1);
    expect(controls.rules[0].ruleId).toBe("R1");
    expect(controls.rules[0].assetReferences).toHaveLength(2);
  });

  it("returns empty controls for null input (fresh project)", () => {
    const controls = buildControlsData(null);
    expect(controls.simple).toEqual([]);
    expect(controls.rules).toEqual([]);
  });

  it("throws when the blob is not valid JSON", () => {
    expect(() => buildControlsData("not-json")).toThrow(
      /Controls: data is not valid JSON/,
    );
  });

  it("throws when a rule is missing ruleId", () => {
    expect(() =>
      buildControlsData(
        JSON.stringify({
          simple: [],
          rules: [
            {
              template: "RULE X",
              assetReferences: [],
            },
          ],
        }),
      ),
    ).toThrow(/Controls: data does not match schema/);
  });

  it("throws when assetReferences is malformed", () => {
    expect(() =>
      buildControlsData(
        JSON.stringify({
          simple: [
            {
              template: "x",
              assetReferences: [
                { assetId: "not-a-number", isActionTarget: true },
              ],
            },
          ],
          rules: [],
        }),
      ),
    ).toThrow(/Controls: data does not match schema/);
  });

  it("throws when top-level shape is wrong", () => {
    expect(() => buildControlsData(JSON.stringify({ simple: [] }))).toThrow(
      /Controls: data does not match schema/,
    );
  });
});
