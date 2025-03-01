import { LabelManager } from "./label-manager";

describe("label manager", () => {
  it("defaults to the id as the label", () => {
    const labelManager = new LabelManager();
    expect(labelManager.generateFor("1", "pipe")).toEqual("P1");
    expect(labelManager.generateFor("1", "junction")).toEqual("J1");
  });

  it("appends a suffix when the id as label is already taken", () => {
    const labelManager = new LabelManager();
    const otherId = "otherID";

    labelManager.register("P1", otherId);

    const newLabel = labelManager.generateFor("1", "pipe");

    expect(newLabel).toEqual("P1.1");
  });

  it("increases suffix when already taken", () => {
    const labelManager = new LabelManager();
    const otherId = "otherID";
    const otherId2 = "otherID2";
    labelManager.register("P1", otherId);
    labelManager.register("P1.1", otherId2);

    expect(labelManager.generateFor("1", "pipe")).toEqual("P1.2");
  });

  it("can have the same label registerd for multiple ids", () => {
    const labelManager = new LabelManager();

    labelManager.register("LABEL_1", "ID_1");
    labelManager.register("LABEL_1", "ID_2");

    expect(labelManager.count("LABEL_1")).toEqual(2);
  });

  it("can delete a previous labels", () => {
    const labelManager = new LabelManager();

    labelManager.register("P1", "ID_1");
    labelManager.register("P1", "ID_2");

    labelManager.remove("P1", "ID_1");

    expect(labelManager.count("P1")).toEqual(1);

    labelManager.remove("P1", "ID_2");
    expect(labelManager.count("P1")).toEqual(0);

    expect(labelManager.generateFor("1", "pipe")).toEqual("P1");
  });
});
