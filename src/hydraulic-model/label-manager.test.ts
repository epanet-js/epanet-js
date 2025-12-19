import { LabelManager } from "./label-manager";

let idCounter = 0;
const anId = () => ++idCounter;

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

  describe("isLabelAvailable", () => {
    it("returns true for unused labels", () => {
      const labelManager = new LabelManager();
      expect(labelManager.isLabelAvailable("NewLabel", "pipe")).toBe(true);
    });

    it("returns false when label is used by same asset type", () => {
      const labelManager = new LabelManager();
      labelManager.register("P1", "pipe", anId());

      expect(labelManager.isLabelAvailable("P1", "pipe")).toBe(false);
    });

    it("returns false when label is used by different asset type in same category (nodes)", () => {
      const labelManager = new LabelManager();
      const junctionId = anId();
      labelManager.register("N1", "junction", junctionId);

      expect(labelManager.isLabelAvailable("N1", "tank")).toBe(false);
      expect(labelManager.isLabelAvailable("N1", "reservoir")).toBe(false);
    });

    it("returns false when label is used by different asset type in same category (links)", () => {
      const labelManager = new LabelManager();
      labelManager.register("L1", "pipe", anId());

      expect(labelManager.isLabelAvailable("L1", "pump")).toBe(false);
      expect(labelManager.isLabelAvailable("L1", "valve")).toBe(false);
    });

    it("returns true when label is used by asset in different category", () => {
      const labelManager = new LabelManager();
      labelManager.register("SHARED", "pipe", anId());

      expect(labelManager.isLabelAvailable("SHARED", "junction")).toBe(true);
      expect(labelManager.isLabelAvailable("SHARED", "tank")).toBe(true);
      expect(labelManager.isLabelAvailable("SHARED", "reservoir")).toBe(true);
    });

    it("returns true when label is used by asset in different category (node to link)", () => {
      const labelManager = new LabelManager();
      labelManager.register("SHARED", "junction", anId());

      expect(labelManager.isLabelAvailable("SHARED", "pipe")).toBe(true);
      expect(labelManager.isLabelAvailable("SHARED", "pump")).toBe(true);
      expect(labelManager.isLabelAvailable("SHARED", "valve")).toBe(true);
    });

    it("excludes specified asset from conflict check", () => {
      const labelManager = new LabelManager();
      const pipeId = anId();
      labelManager.register("P1", "pipe", pipeId);

      expect(labelManager.isLabelAvailable("P1", "pipe", pipeId)).toBe(true);
    });

    it("still detects conflicts when excluding a different asset", () => {
      const labelManager = new LabelManager();
      const pipeId1 = anId();
      const pipeId2 = anId();
      labelManager.register("P1", "pipe", pipeId1);
      labelManager.register("P1", "pipe", pipeId2);

      expect(labelManager.isLabelAvailable("P1", "pipe", pipeId1)).toBe(false);
    });
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
