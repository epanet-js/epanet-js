import { groupIssues } from "./validation-groups";

describe("groupIssues", () => {
  it("builds a group per rule with its affected entities", () => {
    const groups = groupIssues([
      ["pipe.roughness.present", [1, 2]],
      ["pipe.roughness.positive", [3]],
    ]);

    expect(groups).toHaveLength(2);
    const present = groups.find((g) => g.ruleId === "pipe.roughness.present");
    expect(present?.entityIds).toEqual([1, 2]);
  });

  it("resolves entity type and severity from the rule", () => {
    const [group] = groupIssues([["customerPoint.connected", [1]]]);

    expect(group.entityType).toBe("customerPoint");
    expect(group.severity).toBe("warning");
  });

  it("keeps the order the check returned", () => {
    const groups = groupIssues([
      ["pipe.roughness.present", [2]],
      ["customerPoint.connected", [1]],
    ]);

    expect(groups.map((g) => g.ruleId)).toEqual([
      "pipe.roughness.present",
      "customerPoint.connected",
    ]);
  });

  it("skips issues whose rule is not in the rule set", () => {
    expect(groupIssues([["not.a.rule", [1]]])).toEqual([]);
  });

  it("returns an empty array when there are no issues", () => {
    expect(groupIssues([])).toEqual([]);
  });
});
