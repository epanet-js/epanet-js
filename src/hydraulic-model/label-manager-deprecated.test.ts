import { LabelManager } from "./label-manager";

describe("label manager", () => {
  it("defaults to the id as the label", () => {
    const labelManager = new LabelManager();
    expect(labelManager.generateForDeprecated("1", "pipe")).toEqual("P1");
    expect(labelManager.generateForDeprecated("1", "junction")).toEqual("J1");
  });

  it("appends a suffix when the id as label is already taken", () => {
    const labelManager = new LabelManager();
    const otherId = "otherID";

    labelManager.registerDeprecated("P1", otherId);

    const newLabel = labelManager.generateForDeprecated("1", "pipe");

    expect(newLabel).toEqual("P1.1");
  });

  it("increases suffix when already taken", () => {
    const labelManager = new LabelManager();
    const otherId = "otherID";
    const otherId2 = "otherID2";
    labelManager.registerDeprecated("P1", otherId);
    labelManager.registerDeprecated("P1.1", otherId2);

    expect(labelManager.generateForDeprecated("1", "pipe")).toEqual("P1.2");
  });

  it("can have the same label registerDeprecatedd for multiple ids", () => {
    const labelManager = new LabelManager();

    labelManager.registerDeprecated("LABEL_1", "ID_1");
    labelManager.registerDeprecated("LABEL_1", "ID_2");

    expect(labelManager.countDeprecated("LABEL_1")).toEqual(2);
  });

  it("can delete a previous labels", () => {
    const labelManager = new LabelManager();

    labelManager.registerDeprecated("P1", "ID_1");
    labelManager.registerDeprecated("P1", "ID_2");

    labelManager.removeDeprecated("P1", "ID_1");

    expect(labelManager.countDeprecated("P1")).toEqual(1);

    labelManager.removeDeprecated("P1", "ID_2");
    expect(labelManager.countDeprecated("P1")).toEqual(0);

    expect(labelManager.generateForDeprecated("1", "pipe")).toEqual("P1");
  });
});
