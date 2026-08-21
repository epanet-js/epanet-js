import type { ParserIssue } from "@epanet-js/converters";
import { blockingIssues, groupIssues, issueCodes } from "./issues";

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

describe("issueCodes", () => {
  it("de-duplicates keeping the first appearance", () => {
    const issues: ParserIssue[] = [
      { code: "valveKindUnknown", severity: "warning", ref: "1" },
      { code: "unitSystemMissing", severity: "warning" },
      { code: "valveKindUnknown", severity: "warning", ref: "2" },
    ];

    expect(issueCodes(issues)).toEqual([
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
