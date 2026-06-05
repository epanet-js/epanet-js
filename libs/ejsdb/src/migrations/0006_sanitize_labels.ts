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

const NODE_PREFIXES: Record<(typeof NODE_TABLES)[number], string> = {
  junctions: "J",
  reservoirs: "R",
  tanks: "T",
};

const LINK_PREFIXES: Record<(typeof LINK_TABLES)[number], string> = {
  pipes: "P",
  pumps: "PU",
  valves: "V",
};

const MAX_ASSET_LABEL_BYTES = 31;
const MAX_CUSTOMER_POINT_LABEL_CHARS = 50;

const FORBIDDEN_ASSET_CHARS = /[\s;]/g;

const byteLength = (s: string): number => new TextEncoder().encode(s).length;

const truncateToByteLength = (s: string, maxBytes: number): string => {
  if (byteLength(s) <= maxBytes) return s;
  let out = s;
  while (byteLength(out) > maxBytes) out = out.slice(0, -1);
  return out;
};

const upper = (s: string): string => s.toUpperCase();

const isCleanAssetLabel = (label: string | null): boolean => {
  if (label === null || label.length === 0) return false;
  if (label.replace(FORBIDDEN_ASSET_CHARS, "") !== label) return false;
  return byteLength(label) <= MAX_ASSET_LABEL_BYTES;
};

const isCleanCustomerPointLabel = (label: string): boolean =>
  label.length > 0 && label.length <= MAX_CUSTOMER_POINT_LABEL_CHARS;

const sanitizeAssetCandidate = (
  label: string,
  fallbackPrefix: string,
): string => {
  const replaced = label.replace(FORBIDDEN_ASSET_CHARS, "_");
  const truncated = truncateToByteLength(replaced, MAX_ASSET_LABEL_BYTES);
  return truncated.length > 0 ? truncated : fallbackPrefix;
};

const sanitizeCustomerPointCandidate = (label: string): string => {
  const truncated = label.slice(0, MAX_CUSTOMER_POINT_LABEL_CHARS);
  return truncated.length > 0 ? truncated : "CP";
};

const resolveCollision = (
  stem: string,
  claimed: Set<string>,
  maxLength: number,
  unit: "bytes" | "chars",
): string => {
  const lengthOf = unit === "bytes" ? byteLength : (s: string) => s.length;
  const truncate =
    unit === "bytes"
      ? truncateToByteLength
      : (s: string, n: number) => s.slice(0, n);

  let counter = 1;
  while (true) {
    const suffix = `_${counter}`;
    const maxStem = maxLength - suffix.length;
    if (maxStem <= 0) {
      throw new Error(
        `Cannot generate unique label within ${maxLength} ${unit} for stem "${stem}"`,
      );
    }
    const stemToFit = lengthOf(stem) > maxStem ? truncate(stem, maxStem) : stem;
    const candidate = `${stemToFit}${suffix}`;
    if (!claimed.has(upper(candidate))) return candidate;
    counter++;
  }
};

type GroupRow = { id: number; label: string | null; table: string };

const fetchGroupRows = (db: DB, tables: readonly string[]): GroupRow[] => {
  const rows: GroupRow[] = [];
  for (const table of tables) {
    const result = db.exec(`SELECT id, label FROM ${table} ORDER BY id`, {
      returnValue: "resultRows",
      rowMode: "object",
    }) as { id: number; label: string | null }[];
    for (const r of result) {
      rows.push({ id: r.id, label: r.label, table });
    }
  }
  return rows;
};

const LOG_PREFIX = "[migration 0006_sanitize_labels]";

const fixAssetGroup = (
  db: DB,
  tables: readonly string[],
  prefixes: Record<string, string>,
  groupName: string,
) => {
  const rows = fetchGroupRows(db, tables);
  const claimed = new Set<string>();
  const dirty: { row: GroupRow; candidate: string }[] = [];

  for (const row of rows) {
    if (isCleanAssetLabel(row.label)) {
      claimed.add(upper(row.label!));
    } else if (row.label !== null) {
      dirty.push({
        row,
        candidate: sanitizeAssetCandidate(row.label, prefixes[row.table]),
      });
    }
    // NULL labels left untouched; load path will auto-generate.
  }

  if (dirty.length === 0) return;

  const updateStatements: Record<string, SQLStatement> = {};
  for (const table of tables) {
    updateStatements[table] = db.prepare(
      `UPDATE ${table} SET label = ? WHERE id = ?`,
    );
  }

  try {
    for (const { row, candidate } of dirty) {
      const finalLabel = claimed.has(upper(candidate))
        ? resolveCollision(candidate, claimed, MAX_ASSET_LABEL_BYTES, "bytes")
        : candidate;
      claimed.add(upper(finalLabel));
      updateStatements[row.table].bind([finalLabel, row.id]).stepReset();
      // eslint-disable-next-line no-console
      console.info(
        `${LOG_PREFIX} ${row.table}[${row.id}]: ${JSON.stringify(row.label)} → ${JSON.stringify(finalLabel)}`,
      );
    }
  } finally {
    for (const stmt of Object.values(updateStatements)) stmt.finalize();
  }

  // eslint-disable-next-line no-console
  console.info(`${LOG_PREFIX} sanitized ${dirty.length} ${groupName} label(s)`);
};

const fixCustomerPointLabels = (db: DB) => {
  const rows = db.exec("SELECT id, label FROM customer_points ORDER BY id", {
    returnValue: "resultRows",
    rowMode: "object",
  }) as { id: number; label: string }[];

  const claimed = new Set<string>();
  const dirty: { id: number; candidate: string }[] = [];

  for (const row of rows) {
    if (isCleanCustomerPointLabel(row.label)) {
      claimed.add(upper(row.label));
    } else {
      dirty.push({
        id: row.id,
        candidate: sanitizeCustomerPointCandidate(row.label),
      });
    }
  }

  if (dirty.length === 0) return;

  const update = db.prepare(
    "UPDATE customer_points SET label = ? WHERE id = ?",
  );
  const originalLabelById = new Map(rows.map((r) => [r.id, r.label]));

  try {
    for (const { id, candidate } of dirty) {
      const finalLabel = claimed.has(upper(candidate))
        ? resolveCollision(
            candidate,
            claimed,
            MAX_CUSTOMER_POINT_LABEL_CHARS,
            "chars",
          )
        : candidate;
      claimed.add(upper(finalLabel));
      update.bind([finalLabel, id]).stepReset();
      // eslint-disable-next-line no-console
      console.info(
        `${LOG_PREFIX} customer_points[${id}]: ${JSON.stringify(originalLabelById.get(id))} → ${JSON.stringify(finalLabel)}`,
      );
    }
  } finally {
    update.finalize();
  }

  // eslint-disable-next-line no-console
  console.info(
    `${LOG_PREFIX} sanitized ${dirty.length} customer point label(s)`,
  );
};

const sanitizeLabelsMigration = (db: DB): void => {
  fixAssetGroup(db, NODE_TABLES, NODE_PREFIXES, "node");
  fixAssetGroup(db, LINK_TABLES, LINK_PREFIXES, "link");
  fixCustomerPointLabels(db);
};

export default sanitizeLabelsMigration;
