import splitSelectionSetPaths from "./0029_split_selection_set_paths";

describe("splitting selection set paths", () => {
  it("moves a set into the groups its label names", () => {
    const state = createDb([], [aSet("s1", "NORTH/Mains/Loop")]);

    splitSelectionSetPaths(state.db);

    expect(state.sets[0].label).toBe("Loop");
    expect(state.setPaths()).toEqual(["NORTH/Mains/Loop"]);
    expect(state.groupPaths()).toEqual(["NORTH", "NORTH/Mains"]);
  });

  it("shares the groups between sets with a common path", () => {
    const state = createDb(
      [],
      [
        aSet("s1", "NORTH/Mains/Loop"),
        aSet("s2", "NORTH/Mains/Spur"),
        aSet("s3", "NORTH/Valves"),
      ],
    );

    splitSelectionSetPaths(state.db);

    expect(state.sets.map((set) => set.label)).toEqual([
      "Loop",
      "Spur",
      "Valves",
    ]);
    expect(state.setPaths()).toEqual([
      "NORTH/Mains/Loop",
      "NORTH/Mains/Spur",
      "NORTH/Valves",
    ]);
    expect(state.groupPaths()).toEqual(["NORTH", "NORTH/Mains"]);
  });

  it("reuses a group that already exists under the same parent", () => {
    const state = createDb(
      [aGroup("g1", "NORTH"), aGroup("g2", "Mains", "g1")],
      [aSet("s1", "NORTH/Mains/Loop")],
    );

    splitSelectionSetPaths(state.db);

    expect(state.sets[0]).toEqual({ id: "s1", label: "Loop", group_id: "g2" });
    expect(state.groups).toHaveLength(2);
  });

  it("nests the path under the group the set was already in", () => {
    const state = createDb(
      [aGroup("g1", "NORTH")],
      [aSet("s1", "Mains/Loop", "g1")],
    );

    splitSelectionSetPaths(state.db);

    expect(state.sets[0].label).toBe("Loop");
    expect(state.setPaths()).toEqual(["NORTH/Mains/Loop"]);
    expect(state.groupPaths()).toEqual(["NORTH", "NORTH/Mains"]);
  });

  it("starts from the root when the set points at a missing group", () => {
    const state = createDb([], [aSet("s1", "Mains/Loop", "gone")]);

    splitSelectionSetPaths(state.db);

    expect(state.sets[0].label).toBe("Loop");
    expect(state.setPaths()).toEqual(["Mains/Loop"]);
    expect(state.groupPaths()).toEqual(["Mains"]);
  });

  it("trims segments and drops the empty ones", () => {
    const state = createDb(
      [],
      [aSet("s1", " NORTH // Mains / Loop /"), aSet("s2", "/Spur")],
    );

    splitSelectionSetPaths(state.db);

    expect(state.sets.map((set) => set.label)).toEqual(["Loop", "Spur"]);
    expect(state.setPaths()).toEqual(["NORTH/Mains/Loop", "Spur"]);
  });

  it("names a set that is nothing but separators with a placeholder", () => {
    const state = createDb([], [aSet("s1", " / / ")]);

    splitSelectionSetPaths(state.db);

    expect(state.sets[0]).toEqual({ id: "s1", label: "_", group_id: null });
  });

  it("splits a group whose label names a path, keeping its contents", () => {
    const state = createDb(
      [aGroup("g1", "NORTH/Mains"), aGroup("g2", "Old", "g1")],
      [aSet("s1", "Loop", "g1")],
    );

    splitSelectionSetPaths(state.db);

    expect(state.groups.find((group) => group.id === "g1")?.label).toBe(
      "Mains",
    );
    expect(state.setPaths()).toEqual(["NORTH/Mains/Loop"]);
    expect(state.groupPaths()).toContain("NORTH/Mains/Old");
  });

  it("matches group labels by exact case", () => {
    const state = createDb([aGroup("g1", "north")], [aSet("s1", "NORTH/Loop")]);

    splitSelectionSetPaths(state.db);

    expect(state.groupPaths()).toEqual(["north", "NORTH"]);
  });
});

type GroupRow = { id: string; label: string; parent_id: string | null };
type SetRow = { id: string; label: string; group_id: string | null };

const createDb = (initialGroups: GroupRow[], initialSets: SetRow[]) => {
  const groups = initialGroups.map((group) => ({ ...group }));
  const sets = initialSets.map((set) => ({ ...set }));

  const apply = (sql: string, values: unknown[]) => {
    if (sql.startsWith("INSERT INTO selection_set_groups")) {
      const [id, label, parent_id] = values as [string, string, string | null];
      groups.push({ id, label, parent_id });
    } else if (sql.startsWith("UPDATE selection_set_groups")) {
      const [label, parent_id, id] = values as [string, string | null, string];
      Object.assign(groups.find((group) => group.id === id)!, {
        label,
        parent_id,
      });
    } else if (sql.startsWith("UPDATE selection_sets")) {
      const [label, group_id, id] = values as [string, string | null, string];
      Object.assign(sets.find((set) => set.id === id)!, { label, group_id });
    } else {
      throw new Error(`Unexpected statement: ${sql}`);
    }
  };

  const db = {
    exec: (sql: string) => {
      if (sql.includes("FROM selection_set_groups"))
        return groups.map((group) => ({ ...group }));
      if (sql.includes("FROM selection_sets"))
        return sets.map((set) => ({ ...set }));
      return [];
    },
    prepare: (sql: string) => {
      const statement = {
        bind: (values: unknown[]) => {
          apply(sql, values);
          return statement;
        },
        step: () => false,
        reset: () => statement,
        stepReset: () => statement,
        finalize: () => undefined,
      };
      return statement;
    },
  };

  const pathOf = (groupId: string | null): string[] => {
    const group = groups.find((candidate) => candidate.id === groupId);
    return group ? [...pathOf(group.parent_id), group.label] : [];
  };

  return {
    db,
    groups,
    sets,
    setPaths: () =>
      sets.map((set) => [...pathOf(set.group_id), set.label].join("/")),
    groupPaths: () => groups.map((group) => pathOf(group.id).join("/")),
  };
};

const aSet = (
  id: string,
  label: string,
  group_id: string | null = null,
): SetRow => ({ id, label, group_id });

const aGroup = (
  id: string,
  label: string,
  parent_id: string | null = null,
): GroupRow => ({ id, label, parent_id });
