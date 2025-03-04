import { stubFeatureOn } from "src/__helpers__/feature-flags";
import { LabelManager } from "./label-manager";

describe("label manager", () => {
  beforeEach(() => {
    stubFeatureOn("FLAG_LABEL_TYPE");
  });

  it("defaults to the type count and prefixes", () => {
    const labelManager = new LabelManager();
    expect(labelManager.generateFor("pipe")).toEqual("P1");
    expect(labelManager.generateFor("pipe")).toEqual("P2");
    expect(labelManager.generateFor("pipe")).toEqual("P3");
    expect(labelManager.generateFor("junction")).toEqual("J1");
  });

  it("skips until not taken", () => {
    const labelManager = new LabelManager();

    labelManager.register("P1", "pipe");
    labelManager.register("P3", "pipe");

    expect(labelManager.generateFor("pipe")).toEqual("P2");
    expect(labelManager.generateFor("pipe")).toEqual("P4");
    expect(labelManager.generateFor("junction")).toEqual("J1");
  });

  it("can have the same label registerd for multiple ids", () => {
    const labelManager = new LabelManager();

    labelManager.register("LABEL_1", "junction");
    labelManager.register("LABEL_1", "junction");

    expect(labelManager.count("LABEL_1")).toEqual(2);
  });

  it("can delete a previous labels", () => {
    const labelManager = new LabelManager();

    labelManager.register("P1", "pipe");
    labelManager.register("P1", "pipe");

    labelManager.remove("P1", "pipe");

    expect(labelManager.count("P1")).toEqual(1);

    labelManager.remove("P1", "pipe");
    expect(labelManager.count("P1")).toEqual(0);

    expect(labelManager.generateFor("pipe")).toEqual("P1");
  });

  it("fills gaps when removing labels", () => {
    const labelManager = new LabelManager();

    expect(labelManager.generateFor("pipe")).toEqual("P1");
    expect(labelManager.generateFor("pipe")).toEqual("P2");
    expect(labelManager.generateFor("pipe")).toEqual("P3");

    labelManager.remove("P2", "pipe");

    expect(labelManager.generateFor("pipe")).toEqual("P2");
    expect(labelManager.generateFor("pipe")).toEqual("P4");

    labelManager.remove("P2", "pipe");
    labelManager.remove("P4", "pipe");

    expect(labelManager.generateFor("pipe")).toEqual("P2");
    expect(labelManager.generateFor("pipe")).toEqual("P4");
  });

  it("fills gaps after registering labels", () => {
    const labelManager = new LabelManager();

    labelManager.register("P1", "pipe");
    labelManager.register("P3", "pipe");
    labelManager.register("FOO", "pipe");

    expect(labelManager.generateFor("pipe")).toEqual("P2");
    expect(labelManager.generateFor("pipe")).toEqual("P4");
  });
});
