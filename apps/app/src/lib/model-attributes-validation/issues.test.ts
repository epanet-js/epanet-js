import { groupIssues } from "./issues";
import { ValidationIssue } from "./types";

const anIssue = (
  overrides: Partial<ValidationIssue> & Pick<ValidationIssue, "ruleId">,
): ValidationIssue => ({
  entityType: "pipe",
  entityId: 1,
  label: "P1",
  field: "roughness",
  severity: "error",
  message: "required",
  ...overrides,
});

describe("groupIssues", () => {
  it("groups issues by ruleId with affected counts", () => {
    const groups = groupIssues([
      anIssue({ ruleId: "pipe.roughness.present", entityId: 1 }),
      anIssue({ ruleId: "pipe.roughness.present", entityId: 2 }),
      anIssue({
        ruleId: "pipe.roughness.positive",
        entityId: 3,
        message: "mustBePositive",
      }),
    ]);

    expect(groups).toHaveLength(2);
    const present = groups.find((g) => g.ruleId === "pipe.roughness.present");
    expect(present?.issues).toHaveLength(2);
    expect(present?.severity).toBe("error");
    expect(present?.message).toBe("required");
    expect(present?.field).toBe("roughness");
  });

  it("orders error groups before warning groups", () => {
    const groups = groupIssues([
      anIssue({
        ruleId: "customerPoint.connected",
        entityType: "customerPoint",
        field: null,
        severity: "warning",
        message: "disconnected",
      }),
      anIssue({ ruleId: "pipe.roughness.present" }),
    ]);

    expect(groups.map((g) => g.ruleId)).toEqual([
      "pipe.roughness.present",
      "customerPoint.connected",
    ]);
  });

  it("returns an empty array when there are no issues", () => {
    expect(groupIssues([])).toEqual([]);
  });
});
