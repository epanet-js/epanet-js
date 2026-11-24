import type {
  ImportCounts,
  ImportError,
} from "src/lib/operational-data-io/import-result";

export type ImportStats = ImportCounts & { ignored: number };

export type ImportIssue = {
  code: string;
  params?: string[];
  rows: number[];
  columns?: number[];
};

export type ImportOutcome = {
  status: "success" | "info" | "warning" | "failed";
  message?: string;
  stats?: ImportStats;
  issues?: ImportIssue[];
};

type Translate = (key: string, ...args: string[]) => string;

const MAX_LISTED_ROWS = 5;

// One issue per kind of problem, carrying the rows it happened on — a file
// with fifty bad rows reads as two lines, not fifty.
export const groupErrors = (errors: ImportError[]): ImportIssue[] => {
  const issuesByKey = new Map<string, ImportIssue>();

  for (const error of errors) {
    const columnOfRows =
      error.row !== undefined && error.column !== undefined
        ? String(error.column)
        : "";
    const key = [error.code, ...(error.params ?? []), columnOfRows].join(
      "\u0000",
    );
    const issue = issuesByKey.get(key) ?? {
      code: error.code,
      ...(error.params ? { params: error.params } : {}),
      rows: [],
    };
    if (error.row !== undefined) issue.rows.push(error.row);
    if (error.column !== undefined) {
      issue.columns ??= [];
      if (!issue.columns.includes(error.column)) {
        issue.columns.push(error.column);
      }
    }
    issuesByKey.set(key, issue);
  }

  return mergeColumnsWithSameRows([...issuesByKey.values()]);
};

const mergeColumnsWithSameRows = (issues: ImportIssue[]): ImportIssue[] => {
  const merged = new Map<string, ImportIssue>();

  for (const [index, issue] of issues.entries()) {
    const key =
      issue.columns && issue.rows.length > 0
        ? [issue.code, ...(issue.params ?? []), issue.rows.join(",")].join(
            "\u0000",
          )
        : String(index);
    const existing = merged.get(key);
    if (existing?.columns && issue.columns) {
      existing.columns.push(...issue.columns);
    } else {
      merged.set(key, issue);
    }
  }

  return [...merged.values()];
};

const withPositions = (
  text: string,
  positions: number[],
  [oneKey, manyKey, andMoreKey]: [string, string, string],
  translate: Translate,
  keysNamespace: string,
): string => {
  if (positions.length === 0) return text;

  if (positions.length === 1) {
    return translate(`${keysNamespace}.${oneKey}`, text, String(positions[0]));
  }

  const listed = positions.slice(0, MAX_LISTED_ROWS).join(", ");
  const remaining = positions.length - MAX_LISTED_ROWS;

  return translate(
    `${keysNamespace}.${manyKey}`,
    text,
    remaining > 0
      ? translate(`${keysNamespace}.${andMoreKey}`, listed, String(remaining))
      : listed,
  );
};

export const describeIssue = (
  { code, params = [], rows, columns = [] }: ImportIssue,
  translate: Translate,
  keysNamespace: string,
): string => {
  const text = translate(`${keysNamespace}.${code}`, ...params);
  const atColumns = withPositions(
    text,
    columns,
    ["atColumn", "atColumns", "andMoreColumns"],
    translate,
    keysNamespace,
  );
  return withPositions(
    atColumns,
    rows,
    ["atRow", "atRows", "andMoreRows"],
    translate,
    keysNamespace,
  );
};

export const buildImportOutcome = ({
  keysNamespace,
  counts,
  ignored,
  errors,
  extraIssues = [],
  translate,
}: {
  keysNamespace: string;
  counts: ImportCounts;
  ignored: number;
  errors: ImportError[];
  // Codes for problems the parser does not report as row errors.
  extraIssues?: string[];
  translate: Translate;
}): ImportOutcome => {
  const issues = [
    ...extraIssues.map((code) => ({ code, rows: [] })),
    ...groupErrors(errors),
  ];
  const stats = { ...counts, ignored };

  if (issues.length > 0) {
    return {
      status: "warning",
      message: translate(`${keysNamespace}.issuesFound`),
      stats,
      issues,
    };
  }

  // Nothing to flag: the stats are the whole story. An import that left the
  // library as it found it is information rather than a success.
  if (counts.added > 0 || counts.updated > 0) {
    return {
      status: "success",
      message: translate(`${keysNamespace}.imported`),
      stats,
    };
  }

  return {
    status: "info",
    message: translate(`${keysNamespace}.nothingImported`),
    stats,
  };
};
