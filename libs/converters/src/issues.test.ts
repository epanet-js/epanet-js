import { IssueCollector } from "./issues";

describe("issue collector", () => {
  it("starts empty", () => {
    expect(new IssueCollector().build()).toEqual([]);
  });

  it("keeps issues in the order they were reported", () => {
    const collector = new IssueCollector();

    collector.add({ code: "unitSystemMissing", severity: "warning" });
    collector.add({ code: "modelFileUnreadable", severity: "error" });

    expect(collector.build()).toEqual([
      { code: "unitSystemMissing", severity: "warning" },
      { code: "modelFileUnreadable", severity: "error" },
    ]);
  });

  it("reports the same problem about the same entity once", () => {
    const collector = new IssueCollector();

    collector.add({
      code: "nodeCoordinatesMissing",
      severity: "warning",
      ref: "1",
    });
    collector.add({
      code: "nodeCoordinatesMissing",
      severity: "warning",
      ref: "1",
    });

    expect(collector.build()).toEqual([
      { code: "nodeCoordinatesMissing", severity: "warning", ref: "1" },
    ]);
  });

  it("keeps the same problem reported about different entities", () => {
    const collector = new IssueCollector();

    collector.add({
      code: "nodeCoordinatesMissing",
      severity: "warning",
      ref: "1",
    });
    collector.add({
      code: "nodeCoordinatesMissing",
      severity: "warning",
      ref: "2",
    });

    expect(collector.build().map((issue) => issue.ref)).toEqual(["1", "2"]);
  });

  it("keeps different problems reported about the same entity", () => {
    const collector = new IssueCollector();

    collector.add({
      code: "nodeHydraulicsMissing",
      severity: "warning",
      ref: "1",
    });
    collector.add({
      code: "nodeFixedHeadUnsupported",
      severity: "warning",
      ref: "1",
    });

    expect(collector.build().map((issue) => issue.code)).toEqual([
      "nodeHydraulicsMissing",
      "nodeFixedHeadUnsupported",
    ]);
  });
});
