import { LabelManager, LabelType } from "./label-manager";

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

  it("skips taken labels without filling gaps", () => {
    const labelManager = new LabelManager();

    labelManager.register("P1", "pipe", anId());
    labelManager.register("P3", "pipe", anId());
    labelManager.register("P4", "junction", anId());

    expect(labelManager.generateFor("pipe", anId())).toEqual("P2");
    expect(labelManager.generateFor("pipe", anId())).toEqual("P4");
    expect(labelManager.generateFor("junction", anId())).toEqual("J1");
  });

  it("can have the same label registered for multiple ids", () => {
    const labelManager = new LabelManager();

    labelManager.register("LABEL_1", "junction", anId());
    labelManager.register("LABEL_1", "junction", anId());

    expect(labelManager.count("LABEL_1")).toEqual(2);
  });

  it("count is case-insensitive", () => {
    const labelManager = new LabelManager();

    labelManager.register("MyLabel", "junction", anId());
    labelManager.register("mylabel", "junction", anId());

    expect(labelManager.count("MyLabel")).toEqual(2);
    expect(labelManager.count("MYLABEL")).toEqual(2);
    expect(labelManager.count("mylabel")).toEqual(2);
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

  it("remove is case-insensitive", () => {
    const labelManager = new LabelManager();
    const id = anId();

    labelManager.register("MyPipe", "pipe", id);
    expect(labelManager.count("MyPipe")).toEqual(1);

    labelManager.remove("mypipe", "pipe", id);
    expect(labelManager.count("MyPipe")).toEqual(0);
  });

  it("does not fill gaps when removing labels", () => {
    const labelManager = new LabelManager();
    const secondId = anId();

    expect(labelManager.generateFor("pipe", anId())).toEqual("P1");
    expect(labelManager.generateFor("pipe", secondId)).toEqual("P2");
    expect(labelManager.generateFor("pipe", anId())).toEqual("P3");

    labelManager.remove("P2", "pipe", secondId);

    expect(labelManager.generateFor("pipe", anId())).toEqual("P4");
    expect(labelManager.generateFor("pipe", anId())).toEqual("P5");
  });

  it("does not fill gaps after registering labels", () => {
    const labelManager = new LabelManager();

    labelManager.register("P1", "pipe", anId());
    labelManager.register("P3", "pipe", anId());
    labelManager.register("FOO", "pipe", anId());

    expect(labelManager.generateFor("pipe", anId())).toEqual("P2");
    expect(labelManager.generateFor("pipe", anId())).toEqual("P4");
  });

  it("renaming does not advance counter", () => {
    const labelManager = new LabelManager();
    const secondId = anId();

    expect(labelManager.generateFor("pipe", anId())).toEqual("P1");
    expect(labelManager.generateFor("pipe", secondId)).toEqual("P2");
    expect(labelManager.generateFor("pipe", anId())).toEqual("P3");

    labelManager.remove("P2", "pipe", secondId);
    labelManager.register("P10", "pipe", secondId);

    expect(labelManager.generateFor("pipe", anId())).toEqual("P4");
    expect(labelManager.generateFor("pipe", anId())).toEqual("P5");
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
      labelManager.register("N1", "junction", anId());

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

    it("detects duplicates case-insensitively", () => {
      const labelManager = new LabelManager();
      labelManager.register("Pipe1", "pipe", anId());

      expect(labelManager.isLabelAvailable("pipe1", "pipe")).toBe(false);
      expect(labelManager.isLabelAvailable("PIPE1", "pipe")).toBe(false);
      expect(labelManager.isLabelAvailable("Pipe1", "pipe")).toBe(false);
    });

    it("detects duplicates case-insensitively across node types", () => {
      const labelManager = new LabelManager();
      labelManager.register("Node1", "junction", anId());

      expect(labelManager.isLabelAvailable("node1", "tank")).toBe(false);
      expect(labelManager.isLabelAvailable("NODE1", "reservoir")).toBe(false);
    });

    it("allows same label case-insensitively for different categories", () => {
      const labelManager = new LabelManager();
      labelManager.register("Asset1", "pipe", anId());

      expect(labelManager.isLabelAvailable("asset1", "junction")).toBe(true);
      expect(labelManager.isLabelAvailable("ASSET1", "tank")).toBe(true);
    });
  });

  describe("pattern type", () => {
    it("generates PAT-prefixed labels", () => {
      const labelManager = new LabelManager();
      expect(labelManager.generateFor("pattern", anId())).toEqual("PAT1");
      expect(labelManager.generateFor("pattern", anId())).toEqual("PAT2");
      expect(labelManager.generateFor("pattern", anId())).toEqual("PAT3");
    });

    it("skips registered pattern labels without filling gaps", () => {
      const labelManager = new LabelManager();
      labelManager.register("PAT1", "pattern", anId());
      labelManager.register("PAT3", "pattern", anId());

      expect(labelManager.generateFor("pattern", anId())).toEqual("PAT2");
      expect(labelManager.generateFor("pattern", anId())).toEqual("PAT4");
    });

    it("patterns are in their own label group (no conflict with nodes or links)", () => {
      const labelManager = new LabelManager();
      labelManager.register("SHARED", "pattern", anId());

      expect(labelManager.isLabelAvailable("SHARED", "pipe")).toBe(true);
      expect(labelManager.isLabelAvailable("SHARED", "junction")).toBe(true);
      expect(labelManager.isLabelAvailable("SHARED", "pump")).toBe(true);
    });

    it("patterns conflict with other patterns", () => {
      const labelManager = new LabelManager();
      labelManager.register("PAT1", "pattern", anId());

      expect(labelManager.isLabelAvailable("PAT1", "pattern")).toBe(false);
    });

    it("nodes and links do not conflict with patterns", () => {
      const labelManager = new LabelManager();
      labelManager.register("LABEL", "pipe", anId());
      labelManager.register("LABEL", "junction", anId());

      expect(labelManager.isLabelAvailable("LABEL", "pattern")).toBe(true);
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

  describe("shared counters", () => {
    it("two managers with shared counters advance together", () => {
      const sharedCounters = new Map<LabelType, number>();
      const managerA = new LabelManager(sharedCounters);
      const managerB = new LabelManager(sharedCounters);

      expect(managerA.generateFor("pipe", anId())).toEqual("P1");
      expect(managerB.generateFor("pipe", anId())).toEqual("P2");
      expect(managerA.generateFor("junction", anId())).toEqual("J1");
      expect(managerB.generateFor("junction", anId())).toEqual("J2");
    });

    it("register does not advance shared counter", () => {
      const sharedCounters = new Map<LabelType, number>();
      const managerA = new LabelManager(sharedCounters);
      const managerB = new LabelManager(sharedCounters);

      managerA.generateFor("pipe", anId());
      managerB.register("P5", "pipe", anId());

      expect(managerA.generateFor("pipe", anId())).toEqual("P2");
    });

    it("shared counter skips labels registered in other manager", () => {
      const sharedCounters = new Map<LabelType, number>();
      const managerA = new LabelManager(sharedCounters);
      const managerB = new LabelManager(sharedCounters);

      managerA.generateFor("pipe", anId());
      managerA.generateFor("pipe", anId());

      managerB.register("P3", "pipe", anId());
      expect(managerB.generateFor("pipe", anId())).toEqual("P4");
    });

    it("adoptCounters merges local counters into shared map", () => {
      const manager = new LabelManager();
      manager.generateFor("pipe", anId());
      manager.generateFor("pipe", anId());
      manager.generateFor("junction", anId());

      const sharedCounters = new Map<LabelType, number>();
      manager.adoptCounters(sharedCounters);

      expect(sharedCounters.get("pipe")).toEqual(3);
      expect(sharedCounters.get("junction")).toEqual(2);

      expect(manager.generateFor("pipe", anId())).toEqual("P3");
    });

    it("copyTypeFrom copies counter and entries for a single type", () => {
      const source = new LabelManager();
      source.register("CP1", "customerPoint", anId());
      source.register("CP3", "customerPoint", anId());
      source.generateFor("customerPoint", anId());
      source.generateFor("customerPoint", anId());
      source.register("P1", "pipe", anId());

      const target = new LabelManager();
      target.copyTypeFrom("customerPoint", source);

      expect(target.isLabelAvailable("CP1", "customerPoint")).toBe(false);
      expect(target.isLabelAvailable("CP3", "customerPoint")).toBe(false);
      expect(target.isLabelAvailable("P1", "pipe")).toBe(true);
      expect(target.generateFor("customerPoint", anId())).toEqual("CP5");
    });

    it("copyTypeFrom does not mutate the source", () => {
      const source = new LabelManager();
      source.register("CP1", "customerPoint", anId());
      source.generateFor("customerPoint", anId());

      const target = new LabelManager();
      target.copyTypeFrom("customerPoint", source);

      target.generateFor("customerPoint", anId());
      target.register("CP9", "customerPoint", anId());

      expect(source.isLabelAvailable("CP9", "customerPoint")).toBe(true);
      expect(source.generateFor("customerPoint", anId())).toEqual("CP3");
    });

    it("adoptCounters keeps the higher value from shared map", () => {
      const manager = new LabelManager();
      manager.generateFor("pipe", anId());

      const sharedCounters = new Map<LabelType, number>();
      sharedCounters.set("pipe", 10);
      manager.adoptCounters(sharedCounters);

      expect(sharedCounters.get("pipe")).toEqual(10);
      expect(manager.generateFor("pipe", anId())).toEqual("P10");
    });
  });

  describe("search", () => {
    it("returns empty for empty query", () => {
      const manager = new LabelManager();
      manager.register("P1", "pipe", anId());
      expect(manager.search("")).toEqual([]);
    });

    it("matches case-insensitively across types", () => {
      const manager = new LabelManager();
      const p1 = anId();
      const p12 = anId();
      const j3 = anId();
      const cp7 = anId();
      manager.register("P1", "pipe", p1);
      manager.register("P12", "pipe", p12);
      manager.register("J3", "junction", j3);
      manager.register("CP7", "customerPoint", cp7);

      const results = manager.search("p1");
      const labels = results.map((r) => r.label).sort();
      expect(labels).toEqual(["P1", "P12"]);
    });

    it("includes substring matches after prefix matches", () => {
      const manager = new LabelManager();
      manager.register("AP1", "pipe", anId());
      manager.register("P1", "pipe", anId());

      const results = manager.search("P1");
      expect(results.map((r) => r.label)).toEqual(["P1", "AP1"]);
    });

    it("prioritizes exact matches over other prefix matches", () => {
      const manager = new LabelManager();
      manager.register("J12", "junction", anId());
      manager.register("J112", "junction", anId());
      manager.register("J1113", "junction", anId());
      manager.register("J1", "junction", anId());

      const results = manager.search("J1");
      expect(results.map((r) => r.label)).toEqual([
        "J1",
        "J12",
        "J112",
        "J1113",
      ]);
    });

    it("honors the limit", () => {
      const manager = new LabelManager();
      for (let i = 1; i <= 10; i++) {
        manager.register(`P${i}`, "pipe", anId());
      }
      expect(manager.search("P", 3)).toHaveLength(3);
    });

    it("returns entries with id and type", () => {
      const manager = new LabelManager();
      const id = anId();
      manager.register("J5", "junction", id);

      expect(manager.search("J5")).toEqual([
        { label: "J5", type: "junction", id },
      ]);
    });
  });
});
