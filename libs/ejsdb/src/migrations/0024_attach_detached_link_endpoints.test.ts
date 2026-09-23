import attachDetachedLinkEndpoints from "./0024_attach_detached_link_endpoints";

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

const NODE_X = 139.57665175279715;
const NODE_Y = 35.47675490326657;
const END_X = 139.5766548729847;
const END_Y = 35.47676132786697;

// Offsets in degrees at this latitude: longitude shrinks by cos(35.5°) ~ 0.814.
const metresEast = (metres: number) =>
  metres / (111320 * Math.cos(NODE_Y * (Math.PI / 180)));

// What a split left behind: the node's nearest point along the line, 6.3cm off.
const DETACHED_X = NODE_X + metresEast(0.063);

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
  attachDetachedLinkEndpoints(db);
  return updates;
};

describe("attaching detached link endpoints", () => {
  it("moves an endpoint within the tolerance onto its node", () => {
    const updates = runWith([
      [DETACHED_X, NODE_Y],
      [END_X, END_Y],
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

  // A gap that started at centimetres grows to whatever distance the node was
  // dragged, because move-node only carries an endpoint it matches exactly.
  it("moves an endpoint however far it has drifted from its node", () => {
    const updates = runWith([
      [NODE_X + metresEast(400), NODE_Y],
      [END_X, END_Y],
    ]);

    expect(JSON.parse(updates[0].coords)).toStrictEqual([
      [NODE_X, NODE_Y],
      [END_X, END_Y],
    ]);
  });

  // A split could repeat the vertex it cut at. The copy stays put: it sits on
  // the line the endpoint was projected onto, so it reads as a vertex beside the
  // node rather than a spur away from it.
  it("moves the endpoint only, leaving a repeated copy of it in place", () => {
    const updates = runWith([
      [DETACHED_X, NODE_Y],
      [DETACHED_X, NODE_Y],
      [END_X, END_Y],
    ]);

    expect(JSON.parse(updates[0].coords)).toStrictEqual([
      [NODE_X, NODE_Y],
      [DETACHED_X, NODE_Y],
      [END_X, END_Y],
    ]);
  });

  // A bend that merely happens to sit near the end is real geometry.
  it("keeps an interior vertex that is not a copy of the detached one", () => {
    const nearby = [NODE_X + metresEast(0.04), NODE_Y];
    const updates = runWith([
      [DETACHED_X, NODE_Y, 129],
      nearby,
      [END_X, END_Y],
    ]);

    expect(JSON.parse(updates[0].coords)).toStrictEqual([
      [NODE_X, NODE_Y, 129],
      nearby,
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
            [DETACHED_X, NODE_Y],
            [END_X, END_Y],
          ]),
        },
      ],
    );

    attachDetachedLinkEndpoints(db);

    expect(updates).toStrictEqual([]);
  });

  it("redraws a link whose vertices are all one point between its two nodes", () => {
    const stale = [NODE_X + metresEast(12), NODE_Y];
    const updates = runWith([[...stale], [...stale]]);

    expect(JSON.parse(updates[0].coords)).toStrictEqual([
      [NODE_X, NODE_Y],
      [END_X, END_Y],
    ]);
  });

  it("is idempotent", () => {
    const first = runWith([
      [DETACHED_X, NODE_Y],
      [END_X, END_Y],
    ]);

    const second = runWith(JSON.parse(first[0].coords) as number[][]);

    expect(second).toStrictEqual([]);
  });
});
