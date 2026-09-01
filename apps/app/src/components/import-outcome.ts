import type {
  ImportCounts,
  ImportError,
} from "src/lib/operational-data-io/import-result";

export type ImportStats = ImportCounts & { ignored: number };

export type ImportIssue = {
  code: string;
  rows: number[];
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
  const rowsByCode = new Map<string, number[]>();

  for (const error of errors) {
    const rows = rowsByCode.get(error.code) ?? [];
    if (error.row !== undefined) rows.push(error.row);
    rowsByCode.set(error.code, rows);
  }

  return [...rowsByCode.entries()].map(([code, rows]) => ({ code, rows }));
};

export const describeIssue = (
  { code, rows }: ImportIssue,
  translate: Translate,
  keysNamespace: string,
): string => {
  const text = translate(`${keysNamespace}.${code}`);
  if (rows.length === 0) return text;

  if (rows.length === 1) {
    return translate(`${keysNamespace}.atRow`, text, String(rows[0]));
  }

  const listed = rows.slice(0, MAX_LISTED_ROWS).join(", ");
  const remaining = rows.length - MAX_LISTED_ROWS;

  return translate(
    `${keysNamespace}.atRows`,
    text,
    remaining > 0
      ? translate(`${keysNamespace}.andMoreRows`, listed, String(remaining))
      : listed,
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
