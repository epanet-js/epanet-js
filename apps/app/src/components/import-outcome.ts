import { Fragment, createElement, type ReactNode } from "react";
import type {
  ImportCounts,
  ImportError,
} from "src/lib/operational-data-io/import-result";
import type { ImportOutcome } from "./import-export-toolbar";

type Translate = (key: string, ...args: string[]) => string;

const MAX_LISTED_ROWS = 5;

// One line per kind of problem, naming the rows it happened on — a file with
// fifty bad rows reads as two lines, not fifty. File-level problems carry no
// row and are reported on their own.
export const describeErrors = (
  errors: ImportError[],
  translate: Translate,
  keys: string,
): string[] => {
  const rowsByMessage = new Map<string, number[]>();

  for (const error of errors) {
    const rows = rowsByMessage.get(error.message) ?? [];
    if (error.row !== undefined) rows.push(error.row);
    rowsByMessage.set(error.message, rows);
  }

  return [...rowsByMessage.entries()].map(([message, rows]) => {
    const text = translate(message);
    if (rows.length === 0) return text;

    if (rows.length === 1) {
      return translate(`${keys}.atRow`, text, String(rows[0]));
    }

    const listed = rows.slice(0, MAX_LISTED_ROWS).join(", ");
    const remaining = rows.length - MAX_LISTED_ROWS;

    return translate(
      `${keys}.atRows`,
      text,
      remaining > 0
        ? translate(`${keys}.andMoreRows`, listed, String(remaining))
        : listed,
    );
  });
};

// Each domain keeps its own strings — "N ignored" is gendered in some
// languages, so patterns and curves cannot share one phrasing — but the shape
// of the report is the same for both.
export const buildImportOutcome = ({
  keys,
  counts,
  ignored,
  errors,
  extraIssues = [],
  translate,
}: {
  keys: string;
  counts: ImportCounts;
  ignored: number;
  errors: ImportError[];
  extraIssues?: string[];
  translate: Translate;
}): ImportOutcome => {
  // Only the categories that actually happened, so "9 added" is not padded
  // out with zeroes. Ignored is emphasised as the one worth acting on.
  const parts = (
    [
      ["added", counts.added, false],
      ["updated", counts.updated, false],
      ["identical", counts.identical, false],
      ["ignored", ignored, true],
      ["notModified", counts.notModified, false],
    ] as const
  )
    .filter(([, count]) => count > 0)
    .map(([key, count, emphasised]) => ({
      key,
      emphasised,
      text: translate(`${keys}.${key}`, String(count)),
    }));

  const issues = [...extraIssues, ...describeErrors(errors, translate, keys)];
  const summary = parts.map((part) => part.text).join(", ");

  // Nothing to flag: the summary is the whole story. An import that left the
  // library as it found it is information rather than a success.
  if (issues.length === 0) {
    if (counts.added > 0 || counts.updated > 0) {
      return {
        status: "success",
        message: translate(`${keys}.imported`),
        notes: [summary],
      };
    }

    return {
      status: "info",
      message: translate(`${keys}.nothingImported`),
      // An empty file has nothing to break down.
      notes: summary ? [summary] : undefined,
    };
  }

  return {
    status: "warning",
    message: translate(`${keys}.issuesFound`),
    notes: parts.length
      ? [
          parts.map((part, index) =>
            createElement(
              Fragment,
              { key: part.key },
              index > 0 ? ", " : null,
              part.emphasised
                ? createElement(
                    "span",
                    { className: "font-semibold text-warning" },
                    part.text,
                  )
                : part.text,
            ),
          ) as ReactNode,
        ]
      : undefined,
    issues: { summary: translate(`${keys}.issues`), lines: issues },
  };
};
