import {
  blockingIssues,
  distinctIssueCodes,
  groupIssues,
  IssueCollector,
  type ParserIssue,
} from "./issues";

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

describe("blockingIssues", () => {
  it("keeps only errors", () => {
    const issues: ParserIssue[] = [
      { code: "coordinateSystemMissing", severity: "warning" },
      { code: "modelFileUnreadable", severity: "error" },
    ];

    expect(blockingIssues(issues)).toEqual([
      { code: "modelFileUnreadable", severity: "error" },
    ]);
  });

  it("is empty when nothing blocks", () => {
    expect(
      blockingIssues([{ code: "unitSystemMissing", severity: "warning" }]),
    ).toEqual([]);
    expect(blockingIssues([])).toEqual([]);
  });
});

describe("distinctIssueCodes", () => {
  it("de-duplicates keeping the first appearance", () => {
    const issues: ParserIssue[] = [
      { code: "valveKindUnknown", severity: "warning", ref: "1" },
      { code: "unitSystemMissing", severity: "warning" },
      { code: "valveKindUnknown", severity: "warning", ref: "2" },
    ];

    expect(distinctIssueCodes(issues)).toEqual([
      "valveKindUnknown",
      "unitSystemMissing",
    ]);
  });
});

describe("groupIssues", () => {
  it("groups by code in first-seen order", () => {
    const issues: ParserIssue[] = [
      { code: "linkEndpointMissing", severity: "warning", ref: "10" },
      { code: "nodeCoordinatesMissing", severity: "warning", ref: "1" },
      { code: "linkEndpointMissing", severity: "warning", ref: "11" },
    ];

    const groups = groupIssues(issues);

    expect(groups.map((group) => group.code)).toEqual([
      "linkEndpointMissing",
      "nodeCoordinatesMissing",
    ]);
    expect(groups[0].count).toEqual(2);
    expect(groups[0].refs.map(({ ref }) => ref)).toEqual(["10", "11"]);
  });

  it("leaves refs empty for an issue without one", () => {
    const groups = groupIssues([
      {
        code: "unitSystemUnsupported",
        severity: "warning",
        context: { unitSystemType: "IMPERIAL" },
      },
    ]);

    expect(groups).toEqual([
      {
        code: "unitSystemUnsupported",
        count: 1,
        context: ["IMPERIAL"],
        refs: [],
      },
    ]);
  });

  it("keeps the context of each ref", () => {
    const groups = groupIssues([
      {
        code: "valveKindUnknown",
        severity: "warning",
        ref: "3",
        context: { equationType: "PRV" },
      },
      { code: "valveKindUnknown", severity: "warning", ref: "4" },
    ]);

    expect(groups[0].refs).toEqual([
      { ref: "3", context: ["PRV"] },
      { ref: "4", context: [] },
    ]);
  });

  it("stringifies numeric context values", () => {
    const groups = groupIssues([
      {
        code: "nodePressureStatusUnknown",
        severity: "warning",
        ref: "9",
        context: { pressureStatusId: 7 },
      },
    ]);

    expect(groups[0].refs[0].context).toEqual(["7"]);
  });
});
