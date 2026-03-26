import { CustomerPointFactory } from "./customer-point-factory";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { ConsecutiveIdsGenerator } from "src/lib/id-generator";

describe("CustomerPointFactory", () => {
  it("generates CP-prefixed labels with label manager", () => {
    const labelManager = new LabelManager();
    const factory = new CustomerPointFactory(
      new ConsecutiveIdsGenerator(),
      labelManager,
    );

    const cp1 = factory.create([0, 0]);
    const cp2 = factory.create([1, 1]);

    expect(cp1.label).toBe("CP1");
    expect(cp2.label).toBe("CP2");
  });

  it("uses explicit label and registers it with label manager", () => {
    const labelManager = new LabelManager();
    const factory = new CustomerPointFactory(
      new ConsecutiveIdsGenerator(),
      labelManager,
    );

    const cp = factory.create([0, 0], "MyPoint");

    expect(cp.label).toBe("MyPoint");
    expect(labelManager.isLabelAvailable("MyPoint", "customerPoint")).toBe(
      false,
    );
  });

  it("skips registered labels when generating", () => {
    const labelManager = new LabelManager();
    labelManager.register("CP1", "customerPoint", 99);
    const factory = new CustomerPointFactory(
      new ConsecutiveIdsGenerator(),
      labelManager,
    );

    const cp = factory.create([0, 0]);

    expect(cp.label).toBe("CP2");
  });

  it("uses explicit label as-is", () => {
    const labelManager = new LabelManager();
    const factory = new CustomerPointFactory(
      new ConsecutiveIdsGenerator(),
      labelManager,
    );

    const cp = factory.create([0, 0], "CustomLabel");

    expect(cp.label).toBe("CustomLabel");
  });
});
