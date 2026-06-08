import { defaultProjectSettings } from "src/lib/project-settings";
import { serializeProjectSettings } from "./to-rows";

describe("serializeProjectSettings", () => {
  it("produces a JSON string that round-trips through JSON.parse", () => {
    const data = serializeProjectSettings(defaultProjectSettings);
    expect(JSON.parse(data)).toEqual(defaultProjectSettings);
  });

  it("throws when the headloss formula is not a known value", () => {
    expect(() =>
      serializeProjectSettings({
        ...defaultProjectSettings,
        headlossFormula: "NOT-A-FORMULA" as never,
      }),
    ).toThrow(/Project settings: data does not match schema/);
  });

  it("throws when the projection centroid contains a NaN", () => {
    expect(() =>
      serializeProjectSettings({
        ...defaultProjectSettings,
        projection: {
          type: "xy-grid",
          id: "grid",
          name: "Grid",
          centroid: [NaN, 0],
        },
      }),
    ).toThrow(/Project settings: data does not match schema/);
  });
});
