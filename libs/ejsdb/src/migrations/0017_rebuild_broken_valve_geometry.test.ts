import rebuildBrokenValveGeometry from "./0017_rebuild_broken_valve_geometry";

type NodeRow = { id: number; coord_x: number; coord_y: number };
type LinkRow = {
  id: number;
  start_node_id: number;
  end_node_id: number;
  coords: string;
};

const createDb = (nodes: NodeRow[], valves: LinkRow[]) => {
  const updates: { id: number; coords: string }[] = [];
  const queriedTables: string[] = [];

  const db = {
    exec: (sql: string) => {
      const table = /FROM (\w+)/.exec(sql)?.[1] ?? "";
      queriedTables.push(table);
      if (table === "junctions") return nodes;
      if (table === "valves") return valves;
      return [];
    },
    prepare: () => {
      const statement = {
        bind: (values: unknown[]) => {
          updates.push({
            coords: values[0] as string,
            id: values[1] as number,
          });
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

  return { db, updates, queriedTables };
};

const START: [number, number] = [-89.10500484925451, 36.35753623164266];
const END: [number, number] = [-89.10500248243522, 36.35754494311837];
const STRAY: [number, number] = [-89.10500343334523, 36.35754053335264];

const nodes: NodeRow[] = [
  { id: 1, coord_x: START[0], coord_y: START[1] },
  { id: 2, coord_x: END[0], coord_y: END[1] },
];

const runWith = (coords: number[][]) => {
  const { db, updates } = createDb(nodes, [
    {
      id: 10,
      start_node_id: 1,
      end_node_id: 2,
      coords: JSON.stringify(coords),
    },
  ]);
  rebuildBrokenValveGeometry(db);
  return updates;
};

describe("rebuilding broken valve geometry", () => {
  it("redraws a valve that starts partway along its own line", () => {
    const updates = runWith([STRAY, START, END]);

    expect(updates).toHaveLength(1);
    expect(JSON.parse(updates[0].coords)).toStrictEqual([START, END]);
  });

  it("redraws a valve whose end node is missing from the line", () => {
    const updates = runWith([START, STRAY, STRAY]);

    expect(JSON.parse(updates[0].coords)).toStrictEqual([START, END]);
  });

  it("redraws a valve drawn backwards", () => {
    const updates = runWith([END, START]);

    expect(JSON.parse(updates[0].coords)).toStrictEqual([START, END]);
  });

  it("leaves an intact valve alone, bends included", () => {
    const updates = runWith([START, STRAY, END]);

    expect(updates).toStrictEqual([]);
  });

  it("leaves a valve alone when a node is missing", () => {
    const { db, updates } = createDb(
      [],
      [
        {
          id: 10,
          start_node_id: 1,
          end_node_id: 2,
          coords: JSON.stringify([STRAY, START, END]),
        },
      ],
    );

    rebuildBrokenValveGeometry(db);

    expect(updates).toStrictEqual([]);
  });

  it("never reads or rewrites pipes, whose geometry is real", () => {
    const { db, queriedTables } = createDb(nodes, []);

    rebuildBrokenValveGeometry(db);

    expect(queriedTables).not.toContain("pipes");
    expect(queriedTables).toContain("valves");
    expect(queriedTables).toContain("pumps");
  });
});
