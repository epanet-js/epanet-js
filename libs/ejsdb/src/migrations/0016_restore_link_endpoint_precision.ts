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
const LINK_TABLES = ["pipes", "pumps", "valves"] as const;

// Model-build split link geometry through turf at 7 decimal places and persisted
// the rounded result, while node coordinates kept full precision. Consumers match
// a link endpoint against its node by exact equality, so the ~0.5cm gap left the
// endpoint unattached: moving the node silently left the link geometry behind.
const COORD_PRECISION = 7;
const FACTOR = Math.pow(10, COORD_PRECISION);

const LOG_PREFIX = "[migration 0016_restore_link_endpoint_precision]";

const truncateCoordinate = (value: number): number =>
  Math.round(value * FACTOR) / FACTOR;

const isAt = (vertex: number[], node: number[]): boolean =>
  vertex[0] === node[0] && vertex[1] === node[1];

const isTruncationOf = (vertex: number[], node: number[]): boolean =>
  truncateCoordinate(node[0]) === vertex[0] &&
  truncateCoordinate(node[1]) === vertex[1];

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

// lineSplit could repeat a vertex at a cut, so walk the whole leading and
// trailing run. A vertex already sitting on the node is stepped over; anything
// that is not the rounded node stops the walk, leaving real geometry untouched.
const restoreEndpoints = (
  coordinates: number[][],
  startNode: NodePosition | undefined,
  endNode: NodePosition | undefined,
): number[][] | null => {
  const restored = coordinates.map((vertex) => [...vertex]);
  let changed = false;

  if (startNode !== undefined) {
    for (let i = 0; i < restored.length; i++) {
      if (isAt(restored[i], startNode)) continue;
      if (!isTruncationOf(restored[i], startNode)) break;
      restored[i][0] = startNode[0];
      restored[i][1] = startNode[1];
      changed = true;
    }
  }

  if (endNode !== undefined) {
    for (let i = restored.length - 1; i >= 0; i--) {
      if (isAt(restored[i], endNode)) continue;
      if (!isTruncationOf(restored[i], endNode)) break;
      restored[i][0] = endNode[0];
      restored[i][1] = endNode[1];
      changed = true;
    }
  }

  return changed ? restored : null;
};

const restoreLinkTable = (
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
    const restored = restoreEndpoints(
      JSON.parse(row.coords) as number[][],
      nodePositions.get(row.start_node_id),
      nodePositions.get(row.end_node_id),
    );
    if (restored !== null) {
      updates.push({ id: row.id, coords: JSON.stringify(restored) });
    }
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

const restoreLinkEndpointPrecisionMigration = (db: DB): void => {
  const nodePositions = fetchNodePositions(db);

  let total = 0;
  for (const table of LINK_TABLES) {
    total += restoreLinkTable(db, table, nodePositions);
  }

  if (total > 0) {
    // eslint-disable-next-line no-console
    console.info(`${LOG_PREFIX} restored endpoints on ${total} link(s)`);
  }
};

export default restoreLinkEndpointPrecisionMigration;
