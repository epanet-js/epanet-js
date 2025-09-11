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

  describe("generateNextLabel", () => {
    it("generates next numbered label from base label", () => {
      const labelManager = new LabelManager();
      const nextLabel = labelManager.generateNextLabel("MainPipe");
      expect(nextLabel).toEqual("MainPipe_1");
    });

    it("continues counter progression from existing numbered labels", () => {
      const labelManager = new LabelManager();
      const nextLabel = labelManager.generateNextLabel("MainPipe_5");
      expect(nextLabel).toEqual("MainPipe_6");
    });

    it("handles label collisions by finding next available", () => {
      const labelManager = new LabelManager();
      labelManager.register("TestPipe_1", "pipe", anId());
      labelManager.register("TestPipe_2", "pipe", anId());
      const nextLabel = labelManager.generateNextLabel("TestPipe");
      expect(nextLabel).toEqual("TestPipe_3");
    });

    it("handles collisions on numbered labels", () => {
      const labelManager = new LabelManager();
      labelManager.register("MYLABEL_2", "pipe", anId());
      const nextLabel = labelManager.generateNextLabel("MYLABEL_1");
      expect(nextLabel).toEqual("MYLABEL_3");
    });

    describe("31-character length limit", () => {
      it("truncates base to fit suffix", () => {
        const labelManager = new LabelManager();
        const longLabel = "ExtremelyLongPipeNameExampleThatExceedsLimit";

        const nextLabel = labelManager.generateNextLabel(longLabel);

        expect(nextLabel.length).toBeLessThanOrEqual(31);
        expect(nextLabel).toEqual("ExtremelyLongPipeNameExampleT_1");
      });

      it("handles collisions with truncated labels", () => {
        const labelManager = new LabelManager();
        const longLabel = "VeryLongPipeNameExampleHere1234";

        labelManager.register(
          "VeryLongPipeNameExampleHere12_1",
          "pipe",
          anId(),
        );
        labelManager.register(
          "VeryLongPipeNameExampleHere12_2",
          "pipe",
          anId(),
        );

        const nextLabel = labelManager.generateNextLabel(longLabel);

        expect(nextLabel.length).toBeLessThanOrEqual(31);
        expect(nextLabel).toEqual("VeryLongPipeNameExampleHere12_3");
      });

      it("handles numbered input labels with truncation", () => {
        const labelManager = new LabelManager();
        const longLabel = "ExtremelyLongPipeNameExample_5";

        const nextLabel = labelManager.generateNextLabel(longLabel);

        expect(nextLabel.length).toBeLessThanOrEqual(31);
        expect(nextLabel).toEqual("ExtremelyLongPipeNameExample_6");
      });

      it("handles very long labels by truncating appropriately", () => {
        const labelManager = new LabelManager();
        const veryLongLabel = "A".repeat(30);

        const nextLabel = labelManager.generateNextLabel(veryLongLabel);

        expect(nextLabel.length).toBeLessThanOrEqual(31);
        expect(nextLabel).toEqual("A".repeat(29) + "_1");
      });
    });
  });
});
