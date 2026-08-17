import restoreLinkEndpointPrecision from "./0016_restore_link_endpoint_precision";

type NodeRow = { id: number; coord_x: number; coord_y: number };
type LinkRow = {
  id: number;
  start_node_id: number;
  end_node_id: number;
  coords: string;
};

const createDb = (nodes: NodeRow[], pipes: LinkRow[]) => {
  const updates: { id: number; coords: string }[] = [];

  const db = {
    exec: (sql: string) => {
      if (sql.includes("FROM junctions")) return nodes;
      if (sql.includes("FROM reservoirs") || sql.includes("FROM tanks"))
        return [];
      if (sql.includes("FROM pipes")) return pipes;
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

  return { db, updates };
};

// 7 decimal places is what the split rounded to; these differ only below that.
const NODE_X = -89.1073813363806;
const NODE_Y = 36.7620076013956;
const ROUNDED_X = -89.1073813;
const ROUNDED_Y = 36.7620076;

const END_X = -89.1073532558919;
const END_Y = 36.762055573085;
const ROUNDED_END_X = -89.1073533;
const ROUNDED_END_Y = 36.7620556;

const nodes: NodeRow[] = [
  { id: 1, coord_x: NODE_X, coord_y: NODE_Y },
  { id: 2, coord_x: END_X, coord_y: END_Y },
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
  restoreLinkEndpointPrecision(db);
  return updates;
};

describe("restoring link endpoint precision", () => {
  it("puts rounded endpoints back onto their node coordinates", () => {
    const updates = runWith([
      [ROUNDED_X, ROUNDED_Y],
      [ROUNDED_END_X, ROUNDED_END_Y],
    ]);

    expect(updates).toHaveLength(1);
    expect(JSON.parse(updates[0].coords)).toStrictEqual([
      [NODE_X, NODE_Y],
      [END_X, END_Y],
    ]);
  });

  it("leaves a link whose endpoints already match untouched", () => {
    const updates = runWith([
      [NODE_X, NODE_Y],
      [END_X, END_Y],
    ]);

    expect(updates).toStrictEqual([]);
  });

  it("leaves an endpoint that is not merely rounded untouched", () => {
    const updates = runWith([
      [-89.10739, 36.76202],
      [ROUNDED_END_X, ROUNDED_END_Y],
    ]);

    expect(JSON.parse(updates[0].coords)).toStrictEqual([
      [-89.10739, 36.76202],
      [END_X, END_Y],
    ]);
  });

  it("restores a repeated endpoint vertex as a whole run", () => {
    const updates = runWith([
      [ROUNDED_X, ROUNDED_Y],
      [ROUNDED_END_X, ROUNDED_END_Y],
      [ROUNDED_END_X, ROUNDED_END_Y],
    ]);

    expect(JSON.parse(updates[0].coords)).toStrictEqual([
      [NODE_X, NODE_Y],
      [END_X, END_Y],
      [END_X, END_Y],
    ]);
  });

  it("keeps interior vertices and any elevation component", () => {
    const updates = runWith([
      [ROUNDED_X, ROUNDED_Y, 129],
      [-89.10737, 36.76203],
      [ROUNDED_END_X, ROUNDED_END_Y],
    ]);

    expect(JSON.parse(updates[0].coords)).toStrictEqual([
      [NODE_X, NODE_Y, 129],
      [-89.10737, 36.76203],
      [END_X, END_Y],
    ]);
  });

  it("leaves a link alone when its node is missing", () => {
    const { db, updates } = createDb(
      [],
      [
        {
          id: 10,
          start_node_id: 1,
          end_node_id: 2,
          coords: JSON.stringify([
            [ROUNDED_X, ROUNDED_Y],
            [ROUNDED_END_X, ROUNDED_END_Y],
          ]),
        },
      ],
    );

    restoreLinkEndpointPrecision(db);

    expect(updates).toStrictEqual([]);
  });
});
