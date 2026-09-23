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

// Model-build attached a link to the nearest node within its snapping tolerance
// but left the geometry where it was, in two places: find-nodes merges points
// within the tolerance and keeps one of them, and a split cut a pipe at the
// node's nearest point along the line rather than at the node. Consumers match a
// link endpoint against its node by exact equality, so both left the endpoint
// unattached — and moving the node then leaves the link geometry behind, which
// is how a gap that started at a few centimetres grows to whatever distance the
// node was dragged.
//
// 0016 repaired the same defect where the endpoint was the node rounded to 7
// decimal places. That predicate only held when the node already lay on the
// line, so it left most of them — and it is what drove 0016's walk along the
// leading and trailing run. With no predicate left to stop such a walk, this
// migration moves the two endpoints and nothing else.
//
// There is no distance limit on purpose: a link endpoint is its node, and a link
// drawn away from the node it connects to is wrong however far away it is. The
// cost is that where the node id is the wrong fact rather than the geometry, the
// geometry is what moves.
const LOG_PREFIX = "[migration 0024_attach_detached_link_endpoints]";

type NodePosition = [number, number];

const isAt = (vertex: number[], node: NodePosition): boolean =>
  vertex[0] === node[0] && vertex[1] === node[1];

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

// Only the endpoint moves. A split could repeat the vertex it cut at, and the
// copy is left where it is: it sits on the line the endpoint was projected onto,
// so what remains is a vertex beside the node rather than a spur away from it.
const attachEndpoint = (
  vertex: number[] | undefined,
  node: NodePosition | undefined,
): boolean => {
  if (vertex === undefined || node === undefined) return false;
  if (isAt(vertex, node)) return false;

  vertex[0] = node[0];
  vertex[1] = node[1];
  return true;
};

const attachEndpoints = (
  coordinates: number[][],
  startNode: NodePosition | undefined,
  endNode: NodePosition | undefined,
): number[][] | null => {
  const attached = coordinates.map((vertex) => [...vertex]);

  const movedStart = attachEndpoint(attached[0], startNode);
  const movedEnd = attachEndpoint(attached[attached.length - 1], endNode);

  return movedStart || movedEnd ? attached : null;
};

const attachLinkTable = (
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
    const attached = attachEndpoints(
      JSON.parse(row.coords) as number[][],
      nodePositions.get(row.start_node_id),
      nodePositions.get(row.end_node_id),
    );
    if (attached !== null) {
      updates.push({ id: row.id, coords: JSON.stringify(attached) });
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

const attachDetachedLinkEndpointsMigration = (db: DB): void => {
  const nodePositions = fetchNodePositions(db);

  let total = 0;
  for (const table of LINK_TABLES) {
    total += attachLinkTable(db, table, nodePositions);
  }

  if (total > 0) {
    // eslint-disable-next-line no-console
    console.info(`${LOG_PREFIX} attached endpoints on ${total} link(s)`);
  }
};

export default attachDetachedLinkEndpointsMigration;
