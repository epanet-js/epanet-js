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

type GroupRow = { id: string; label: string; parent_id: string | null };
type SetRow = { id: string; label: string; group_id: string | null };

const SEPARATOR = "/";
const EMPTY_LABEL = "_";

const segmentsOf = (label: string): string[] =>
  label
    .split(SEPARATOR)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

const readRows = <T>(db: DB, sql: string): T[] =>
  db.exec(sql, { returnValue: "resultRows", rowMode: "object" }) as T[];

const splitSelectionSetPathsMigration = (db: DB): void => {
  const groups = readRows<GroupRow>(
    db,
    "SELECT id, label, parent_id FROM selection_set_groups ORDER BY rowid",
  );
  const sets = readRows<SetRow>(
    db,
    "SELECT id, label, group_id FROM selection_sets ORDER BY rowid",
  );

  const pathGroups = groups.filter((group) => group.label.includes(SEPARATOR));
  const pathSets = sets.filter((set) => set.label.includes(SEPARATOR));
  if (pathGroups.length === 0 && pathSets.length === 0) return;

  const knownGroupIds = new Set(groups.map((group) => group.id));
  const existing = (id: string | null): string | null =>
    id !== null && knownGroupIds.has(id) ? id : null;

  const insertGroup = db.prepare(
    "INSERT INTO selection_set_groups (id, label, parent_id) VALUES (?, ?, ?)",
  );
  const updateGroup = db.prepare(
    "UPDATE selection_set_groups SET label = ?, parent_id = ? WHERE id = ?",
  );
  const updateSet = db.prepare(
    "UPDATE selection_sets SET label = ?, group_id = ? WHERE id = ?",
  );

  const ensurePath = (
    parentId: string | null,
    labels: string[],
  ): string | null => {
    let current = parentId;
    for (const label of labels) {
      const parent = current;
      let group = groups.find(
        (candidate) =>
          candidate.label === label && existing(candidate.parent_id) === parent,
      );
      if (!group) {
        group = { id: crypto.randomUUID(), label, parent_id: parent };
        groups.push(group);
        knownGroupIds.add(group.id);
        insertGroup.bind([group.id, group.label, group.parent_id]).stepReset();
      }
      current = group.id;
    }
    return current;
  };

  try {
    for (const group of pathGroups) {
      const segments = segmentsOf(group.label);
      const label = segments.pop() ?? EMPTY_LABEL;
      const parentId = ensurePath(existing(group.parent_id), segments);
      group.label = label;
      group.parent_id = parentId;
      updateGroup.bind([label, parentId, group.id]).stepReset();
    }

    for (const set of pathSets) {
      const segments = segmentsOf(set.label);
      const label = segments.pop() ?? EMPTY_LABEL;
      const groupId = ensurePath(existing(set.group_id), segments);
      updateSet.bind([label, groupId, set.id]).stepReset();
    }
  } finally {
    insertGroup.finalize();
    updateGroup.finalize();
    updateSet.finalize();
  }
};

export default splitSelectionSetPathsMigration;
