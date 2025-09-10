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

  describe("generateSplitLabels", () => {
    it("generates basic split labels", () => {
      const labelManager = new LabelManager();

      const [label1, label2] = labelManager.generateSplitLabels("MainPipe");

      expect(label1).toEqual("MainPipe_1");
      expect(label2).toEqual("MainPipe_2");
      expect(label1).not.toEqual(label2);
    });

    it("handles label collisions", () => {
      const labelManager = new LabelManager();
      labelManager.register("TestPipe_1", "pipe", anId());
      labelManager.register("TestPipe_2", "pipe", anId());

      const [label1, label2] = labelManager.generateSplitLabels("TestPipe");

      expect(label1).toEqual("TestPipe_3");
      expect(label2).toEqual("TestPipe_4");
      expect(label1).not.toEqual(label2);
    });

    it("continues counter progression from existing numbered labels", () => {
      const labelManager = new LabelManager();

      const [label1, label2] = labelManager.generateSplitLabels("MainPipe_5");

      expect(label1).toEqual("MainPipe_6");
      expect(label2).toEqual("MainPipe_7");
      expect(label1).not.toEqual(label2);
    });

    it("handles gaps in existing counters", () => {
      const labelManager = new LabelManager();
      labelManager.register("TestPipe_1", "pipe", anId());
      labelManager.register("TestPipe_3", "pipe", anId());

      const [label1, label2] = labelManager.generateSplitLabels("TestPipe");

      expect(label1).toEqual("TestPipe_2");
      expect(label2).toEqual("TestPipe_4");
      expect(label1).not.toEqual(label2);
    });

    it("avoids nested suffixes for already numbered inputs", () => {
      const labelManager = new LabelManager();
      labelManager.register("MYLABEL_1", "pipe", anId());

      const [label1, label2] = labelManager.generateSplitLabels("MYLABEL_1");

      expect(label1).toEqual("MYLABEL_2");
      expect(label2).toEqual("MYLABEL_3");
      expect(label1).not.toMatch(/_1_/);
      expect(label2).not.toMatch(/_1_/);
    });

    describe("31-character length limit", () => {
      it("truncates base to fit suffixes", () => {
        const labelManager = new LabelManager();
        const longLabel = "ExtremelyLongPipeNameExampleThatExceedsLimit";

        const [label1, label2] = labelManager.generateSplitLabels(longLabel);

        expect(label1.length).toBeLessThanOrEqual(31);
        expect(label2.length).toBeLessThanOrEqual(31);
        expect(label1).toEqual("ExtremelyLongPipeNameExampleT_1");
        expect(label2).toEqual("ExtremelyLongPipeNameExampleT_2");
      });

      it("handles collisions with progressive truncation", () => {
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

        const [label1, label2] = labelManager.generateSplitLabels(longLabel);

        expect(label1.length).toBeLessThanOrEqual(31);
        expect(label2.length).toBeLessThanOrEqual(31);
        expect(label1).not.toEqual(label2);
      });
    });
  });
});
