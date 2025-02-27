import { LabelManager } from "./label-manager";

describe("label manager", () => {
  it("defaults to the id as the label", () => {
    const labelManager = new LabelManager();
    const id = "ID";

    const label = labelManager.generateFor(id);

    expect(label).toEqual(id);
  });

  it("appends a suffix when the id as label is already taken", () => {
    const labelManager = new LabelManager();
    const otherId = "otherID";
    const takenLabel = "takenLabel";

    labelManager.register(takenLabel, otherId);

    let newId = takenLabel;
    let newLabel = labelManager.generateFor(newId);

    expect(newLabel).toEqual("takenLabel.1");
    labelManager.register(newLabel, newId);

    newId = takenLabel;
    newLabel = labelManager.generateFor(newId);

    expect(newLabel).toEqual("takenLabel.2");
  });

  it("can have the same label registerd for multiple ids", () => {
    const labelManager = new LabelManager();

    labelManager.register("LABEL_1", "ID_1");
    labelManager.register("LABEL_1", "ID_2");

    expect(labelManager.count("LABEL_1")).toEqual(2);
  });

  it("can delete a previous labels", () => {
    const labelManager = new LabelManager();

    labelManager.register("LABEL_1", "ID_1");
    labelManager.register("LABEL_1", "ID_2");

    labelManager.remove("LABEL_1", "ID_1");

    expect(labelManager.count("LABEL_1")).toEqual(1);
  });
});
