type SQLStatement = {
  bind: (values: unknown[]) => SQLStatement;
  step: () => boolean;
  reset: (alsoBindValues?: boolean) => SQLStatement;
  stepReset: () => SQLStatement;
  finalize: () => void;
};

type DB = {
  exec: (
    sql: string,
    opts?: {
      bind?: unknown[];
      returnValue?: "this" | "resultRows" | "saveSql";
      rowMode?: "array" | "object";
    },
  ) => unknown;
  prepare: (sql: string) => SQLStatement;
};

const NODE_TABLES = ["junctions", "reservoirs", "tanks"] as const;

// Model-build expanded valves and pumps out of a point by slicing a stub off each
// adjacent pipe, and an identity comparison decided which way to orient the two
// halves. It read wrong whenever the node carried a Z, so the halves were joined
// back-to-front: the line doubles over itself, and often the end node's position
// is missing from the geometry altogether.
//
// Only the vertex order was lost — start_node_id and end_node_id stayed correct —
// so the fix is to redraw the link straight between its two nodes. These links are
// around a metre long and the stray vertices sit within a few millimetres of that
// straight line, so nothing meaningful is discarded. Pipes are deliberately out of
// scope: they carry real surveyed geometry that must never be flattened.
const EXPANDED_LINK_TABLES = ["valves", "pumps"] as const;

const LOG_PREFIX = "[migration 0017_rebuild_broken_valve_geometry]";

type NodePosition = [number, number];

const fetchNodePositions = (db: DB): Map<number, NodePosition> => {
  const positions = new Map<number, NodePosition>();
  for (const table of NODE_TABLES) {
    const rows = db.exec(`SELECT id, coord_x, coord_y FROM ${table}`, {
      returnValue: "resultRows",
      rowMode: "object",
    }) as { id: number; coord_x: number; coord_y: number }[];
    for (const row of rows) {
      positions.set(row.id, [row.coord_x, row.coord_y]);
    }
  }
  return positions;
};

const isAt = (vertex: number[], node: NodePosition): boolean =>
  vertex[0] === node[0] && vertex[1] === node[1];

const rebuildLinkTable = (
  db: DB,
  table: string,
  nodePositions: Map<number, NodePosition>,
): number => {
  const rows = db.exec(
    `SELECT id, start_node_id, end_node_id, coords FROM ${table}`,
    { returnValue: "resultRows", rowMode: "object" },
  ) as {
    id: number;
    start_node_id: number;
    end_node_id: number;
    coords: string;
  }[];

  const updates: { id: number; coords: string }[] = [];
  for (const row of rows) {
    const startNode = nodePositions.get(row.start_node_id);
    const endNode = nodePositions.get(row.end_node_id);
    if (startNode === undefined || endNode === undefined) continue;

    const coordinates = JSON.parse(row.coords) as number[][];
    const isIntact =
      isAt(coordinates[0], startNode) &&
      isAt(coordinates[coordinates.length - 1], endNode);
    if (isIntact) continue;

    updates.push({
      id: row.id,
      coords: JSON.stringify([startNode, endNode]),
    });
  }

  if (updates.length === 0) return 0;

  const update = db.prepare(`UPDATE ${table} SET coords = ? WHERE id = ?`);
  try {
    for (const { id, coords } of updates) {
      update.bind([coords, id]).stepReset();
    }
  } finally {
    update.finalize();
  }

  return updates.length;
};

const rebuildBrokenValveGeometryMigration = (db: DB): void => {
  const nodePositions = fetchNodePositions(db);

  let total = 0;
  for (const table of EXPANDED_LINK_TABLES) {
    total += rebuildLinkTable(db, table, nodePositions);
  }

  if (total > 0) {
    // eslint-disable-next-line no-console
    console.info(`${LOG_PREFIX} redrew ${total} link(s) between their nodes`);
  }
};

export default rebuildBrokenValveGeometryMigration;
