import { LabelManager } from "./label-manager";
import { nanoid } from "nanoid";

const anId = () => nanoid();

describe("label manager", () => {
  it("defaults to the type count and prefixes", () => {
    const labelManager = new LabelManager();
    expect(labelManager.generateFor("pipe", anId())).toEqual("P1");
    expect(labelManager.generateFor("pipe", anId())).toEqual("P2");
    expect(labelManager.generateFor("pipe", anId())).toEqual("P3");
    expect(labelManager.generateFor("junction", anId())).toEqual("J1");
  });

  it("skips until not taken for the same type", () => {
    const labelManager = new LabelManager();

    labelManager.register("P1", "pipe", anId());
    labelManager.register("P3", "pipe", anId());
    labelManager.register("P4", "junction", anId());

    expect(labelManager.generateFor("pipe", anId())).toEqual("P2");
    expect(labelManager.generateFor("pipe", anId())).toEqual("P4");
    expect(labelManager.generateFor("junction", anId())).toEqual("J1");
  });

  it("can have the same label registerd for multiple ids", () => {
    const labelManager = new LabelManager();

    labelManager.register("LABEL_1", "junction", anId());
    labelManager.register("LABEL_1", "junction", anId());

    expect(labelManager.count("LABEL_1")).toEqual(2);
  });

  it("only register once a label for the same asset", () => {
    const labelManager = new LabelManager();

    const junctionId = anId();
    labelManager.register("LABEL_1", "junction", junctionId);
    labelManager.register("LABEL_1", "junction", junctionId);

    expect(labelManager.count("LABEL_1")).toEqual(1);
  });

  it("can delete a previous label", () => {
    const labelManager = new LabelManager();
    const firstId = anId();
    const secondId = anId();

    labelManager.register("P1", "pipe", firstId);
    labelManager.register("P1", "pipe", secondId);

    labelManager.remove("P1", "pipe", firstId);

    expect(labelManager.count("P1")).toEqual(1);

    labelManager.remove("P1", "pipe", secondId);
    expect(labelManager.count("P1")).toEqual(0);

    expect(labelManager.generateFor("pipe", firstId)).toEqual("P1");
  });

  it("fills gaps when removing labels", () => {
    const labelManager = new LabelManager();
    const secondId = anId();

    expect(labelManager.generateFor("pipe", anId())).toEqual("P1");
    expect(labelManager.generateFor("pipe", secondId)).toEqual("P2");
    expect(labelManager.generateFor("pipe", anId())).toEqual("P3");

    labelManager.remove("P2", "pipe", secondId);

    expect(labelManager.generateFor("pipe", anId())).toEqual("P2");
    expect(labelManager.generateFor("pipe", anId())).toEqual("P4");
  });

  it("fills gaps after registering labels", () => {
    const labelManager = new LabelManager();

    labelManager.register("P1", "pipe", anId());
    labelManager.register("P3", "pipe", anId());
    labelManager.register("FOO", "pipe", anId());

    expect(labelManager.generateFor("pipe", anId())).toEqual("P2");
    expect(labelManager.generateFor("pipe", anId())).toEqual("P4");
  });
});
