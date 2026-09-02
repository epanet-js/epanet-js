import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider } from "jotai";
import { vi } from "vitest";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import type { Pattern, Patterns } from "src/hydraulic-model";
import type { Store } from "src/state";
import type { ImportOutcome } from "src/components/import-outcome";
import { ImportOutcomeReport } from "src/components/import-outcome-report";
import {
  ImportExportPatternsToolbar,
  PATTERNS_IMPORT_KEYS,
} from "./import-export-patterns-toolbar";

const exportToCsv = vi.fn();
const exportToXlsx = vi.fn();

vi.mock("src/commands/export-patterns", () => ({
  useExportPatterns: () => ({ exportToCsv, exportToXlsx }),
}));

const importPatterns = vi.fn();

vi.mock("src/commands/import-patterns", () => ({
  useImportPatterns: () => importPatterns,
}));

const MODEL_INTERVAL = 3600;

const patternsOf = (...items: Pattern[]): Patterns =>
  new Map(items.map((p) => [p.id, p]));

const importing = (
  patterns: {
    label: string;
    type?: string;
    intervalSeconds?: number;
    multipliers: number[];
  }[],
  overrides: { status?: string; errors?: { message: string }[] } = {},
) =>
  importPatterns.mockResolvedValue({
    status: overrides.status ?? "success",
    format: "csv",
    patterns,
    errors: overrides.errors ?? [],
  });

// The dialog shows the report over its empty state; here it stands in for
// that so the outcome can be read as the user would see it.
const Harness = ({
  patterns,
  readOnly,
  onImported,
}: {
  patterns: Patterns;
  readOnly?: boolean;
  onImported: (patterns: Patterns | null, outcome: ImportOutcome) => void;
}) => {
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [isImporting, setImporting] = useState(false);

  return (
    <>
      <ImportExportPatternsToolbar
        patterns={patterns}
        intervalSeconds={MODEL_INTERVAL}
        onImported={(merged, result) => {
          onImported(merged, result);
          setOutcome(result);
        }}
        isImporting={isImporting}
        onImportingChange={setImporting}
        readOnly={readOnly}
      />
      {outcome && (
        <ImportOutcomeReport
          outcome={outcome}
          translationKeys={PATTERNS_IMPORT_KEYS}
          onDismiss={() => setOutcome(null)}
        />
      )}
    </>
  );
};

const renderToolbar = (
  patterns: Patterns,
  props: { readOnly?: boolean } = {},
) => {
  const store: Store = setInitialState({});
  const onImported =
    vi.fn<(patterns: Patterns | null, outcome: ImportOutcome) => void>();

  render(
    <JotaiProvider store={store}>
      <Harness
        patterns={patterns}
        readOnly={props.readOnly}
        onImported={onImported}
      />
    </JotaiProvider>,
  );

  return { onImported };
};

const setupUser = () => userEvent.setup();

const clickImport = (user: ReturnType<typeof setupUser>) =>
  user.click(screen.getByRole("button", { name: /^import$/i }));

const lastImported = (
  onImported: ReturnType<typeof renderToolbar>["onImported"],
): Patterns => {
  const [merged] = onImported.mock.calls[onImported.mock.calls.length - 1];
  if (!merged) throw new Error("nothing was merged");
  return merged;
};

describe("ImportExportPatternsToolbar", () => {
  beforeEach(() => {
    stubUserTracking();
    vi.clearAllMocks();
  });

  describe("exporting", () => {
    it("exports the patterns it was given as CSV", async () => {
      const user = setupUser();
      const patterns = patternsOf({
        id: 1,
        label: "PAT1",
        type: "demand",
        multipliers: [1],
      });

      renderToolbar(patterns);
      await user.click(screen.getByRole("button", { name: /export/i }));
      await user.click(screen.getByRole("menuitem", { name: /\.csv/i }));

      await waitFor(() => expect(exportToCsv).toHaveBeenCalled());
      expect(exportToCsv.mock.calls[0][0]).toBe(patterns);
    });

    it("exports as XLSX", async () => {
      const user = setupUser();

      renderToolbar(patternsOf({ id: 1, label: "PAT1", multipliers: [1] }));
      await user.click(screen.getByRole("button", { name: /export/i }));
      await user.click(screen.getByRole("menuitem", { name: /\.xlsx/i }));

      await waitFor(() => expect(exportToXlsx).toHaveBeenCalled());
    });

    it("passes the model interval through to the exporter", async () => {
      const user = setupUser();

      renderToolbar(patternsOf({ id: 1, label: "PAT1", multipliers: [1] }));
      await user.click(screen.getByRole("button", { name: /export/i }));
      await user.click(screen.getByRole("menuitem", { name: /\.csv/i }));

      await waitFor(() => expect(exportToCsv).toHaveBeenCalled());
      expect(exportToCsv.mock.calls[0][1].intervalSeconds).toEqual(
        MODEL_INTERVAL,
      );
    });
  });

  describe("importing", () => {
    it("appends a pattern that is not already in the draft", async () => {
      const user = setupUser();
      importing([{ label: "NewOne", type: "demand", multipliers: [2, 3] }]);

      const { onImported } = renderToolbar(
        patternsOf({ id: 1, label: "PAT1", type: "demand", multipliers: [1] }),
      );
      await clickImport(user);

      await waitFor(() => expect(onImported).toHaveBeenCalled());
      expect(
        [...lastImported(onImported).values()].map((p) => p.label),
      ).toEqual(["PAT1", "NewOne"]);
    });

    it("replaces a matching pattern in place, keeping its id", async () => {
      const user = setupUser();
      importing([{ label: "PAT1", type: "demand", multipliers: [5, 6] }]);

      const { onImported } = renderToolbar(
        patternsOf({ id: 7, label: "PAT1", type: "demand", multipliers: [1] }),
      );
      await clickImport(user);

      await waitFor(() => expect(onImported).toHaveBeenCalled());
      expect(lastImported(onImported).get(7)?.multipliers).toEqual([5, 6]);
    });

    it("keeps the ignored patterns collapsed until asked for", async () => {
      const user = setupUser();
      importPatterns.mockResolvedValue({
        status: "partial",
        format: "csv",
        patterns: [{ label: "PAT1", type: "demand", multipliers: [1] }],
        ignored: 2,
        errors: [
          { code: "missingLabel", row: 3 },
          { code: "invalidMultiplier", row: 4 },
        ],
      });

      renderToolbar(patternsOf({ id: 1, label: "PAT1", multipliers: [9] }));
      await clickImport(user);

      const summary = await screen.findByText(/^issues$/i);
      const reason = screen.getByText(/missing pattern name.*\(row 3\)/i);
      expect(reason).not.toBeVisible();

      await user.click(summary);

      expect(reason).toBeVisible();
      expect(screen.getByText(/invalid multiplier.*\(row 4\)/i)).toBeVisible();
    });

    it("states the result on one line and puts the breakdown below it", async () => {
      const user = setupUser();
      importing([{ label: "NewOne", type: "demand", multipliers: [1] }]);

      renderToolbar(patternsOf({ id: 1, label: "PAT1", multipliers: [1] }));
      await clickImport(user);

      expect(
        await screen.findByText("Patterns imported: 1 added, 1 not modified"),
      ).toBeVisible();
      expect(screen.queryByText(/found issues/i)).not.toBeInTheDocument();
    });

    it("reports an import that changed nothing as information", async () => {
      const user = setupUser();
      importing([{ label: "PAT1", type: "demand", multipliers: [1] }]);

      renderToolbar(
        patternsOf(
          { id: 1, label: "PAT1", type: "demand", multipliers: [1] },
          { id: 2, label: "PAT2", type: "demand", multipliers: [2] },
        ),
      );
      await clickImport(user);

      expect(
        await screen.findByText(
          "Nothing was imported: 1 identical, 1 not modified",
        ),
      ).toBeVisible();
    });

    it("names only the categories that happened", async () => {
      const user = setupUser();
      importing([
        { label: "PAT1", type: "demand", multipliers: [5] },
        { label: "NewOne", type: "demand", multipliers: [1] },
      ]);

      renderToolbar(
        patternsOf({ id: 1, label: "PAT1", type: "demand", multipliers: [1] }),
      );
      await clickImport(user);

      expect(
        await screen.findByText("Patterns imported: 1 added, 1 updated"),
      ).toBeVisible();
    });

    it("still leads with what was imported when some patterns were ignored", async () => {
      const user = setupUser();
      importPatterns.mockResolvedValue({
        status: "partial",
        format: "csv",
        patterns: [{ label: "PAT1", type: "demand", multipliers: [1] }],
        ignored: 1,
        errors: [{ code: "missingLabel", row: 3 }],
      });

      renderToolbar(patternsOf({ id: 1, label: "PAT1", multipliers: [9] }));
      await clickImport(user);

      expect(
        await screen.findByText(/found issues while importing/i),
      ).toBeVisible();
      expect(screen.getByText("1 ignored")).toBeVisible();
    });

    it("shows no expandable section when nothing was ignored", async () => {
      const user = setupUser();
      importing([{ label: "NewOne", type: "demand", multipliers: [1] }]);

      renderToolbar(patternsOf({ id: 1, label: "PAT1", multipliers: [1] }));
      await clickImport(user);

      await screen.findByText("Patterns imported: 1 added, 1 not modified");
      expect(screen.queryByText(/^issues$/i)).not.toBeInTheDocument();
    });

    it("reports what was updated and what the file did not mention", async () => {
      const user = setupUser();
      importing([{ label: "PAT1", type: "demand", multipliers: [9] }]);

      renderToolbar(
        patternsOf(
          { id: 1, label: "PAT1", type: "demand", multipliers: [1] },
          { id: 2, label: "PAT2", type: "demand", multipliers: [2] },
        ),
      );
      await clickImport(user);

      await waitFor(() =>
        expect(
          screen.getByText("Patterns imported: 1 updated, 1 not modified"),
        ).toBeVisible(),
      );
    });

    it("reports the ignored interval as an issue", async () => {
      const user = setupUser();
      importing([
        {
          label: "PAT1",
          type: "demand",
          intervalSeconds: MODEL_INTERVAL + 1800,
          multipliers: [9],
        },
      ]);

      renderToolbar(
        patternsOf({ id: 1, label: "PAT1", type: "demand", multipliers: [1] }),
      );
      await clickImport(user);

      await waitFor(() => expect(screen.getByText(/^issues$/i)).toBeVisible());
      expect(
        screen.getByText(/interval value differs from project settings/i),
      ).toBeInTheDocument();
    });

    it("stays quiet about the interval when it matches", async () => {
      const user = setupUser();
      importing([
        {
          label: "PAT1",
          type: "demand",
          intervalSeconds: MODEL_INTERVAL,
          multipliers: [9],
        },
      ]);

      renderToolbar(
        patternsOf({ id: 1, label: "PAT1", type: "demand", multipliers: [1] }),
      );
      await clickImport(user);

      await waitFor(() =>
        expect(screen.getByText(/added|updated|identical/i)).toBeVisible(),
      );
      expect(
        screen.queryByText(/interval value differs from project settings/i),
      ).not.toBeInTheDocument();
    });

    it("shows the parse error and imports nothing when the file is unreadable", async () => {
      const user = setupUser();
      importPatterns.mockResolvedValue({
        status: "error",
        patterns: [],
        errors: [{ code: "unsupportedFormat" }],
      });

      const { onImported } = renderToolbar(
        patternsOf({ id: 1, label: "PAT1", multipliers: [1] }),
      );
      await clickImport(user);

      await waitFor(() =>
        expect(screen.getByText(/only \.csv and \.xlsx/i)).toBeVisible(),
      );
      expect(onImported.mock.calls[0][0]).toBeNull();
    });

    it("groups problems by kind and names the rows they happened on", async () => {
      const user = setupUser();
      importPatterns.mockResolvedValue({
        status: "error",
        format: "csv",
        patterns: [],
        errors: [
          { code: "notAValidPatternsFile" },
          { code: "missingLabel", row: 2 },
          { code: "missingLabel", row: 5 },
          { code: "invalidMultiplier", row: 3 },
        ],
      });

      renderToolbar(patternsOf({ id: 1, label: "PAT1", multipliers: [1] }));
      await clickImport(user);

      await screen.findByText(/does not look like a patterns file/i);
      await user.click(screen.getByText(/^issues$/i));

      expect(
        screen.getByText(/missing pattern name.*\(rows 2, 5\)/i),
      ).toBeVisible();
      expect(screen.getByText(/invalid multiplier.*\(row 3\)/i)).toBeVisible();
      expect(screen.getAllByText(/missing pattern name/i)).toHaveLength(1);
    });

    it("truncates a very long row list", async () => {
      const user = setupUser();
      importPatterns.mockResolvedValue({
        status: "error",
        format: "csv",
        patterns: [],
        errors: Array.from({ length: 14 }, (_, i) => ({
          code: "missingLabel",
          row: i + 2,
        })),
      });

      renderToolbar(patternsOf({ id: 1, label: "PAT1", multipliers: [1] }));
      await clickImport(user);

      const banner = await screen.findByText(/missing pattern name/i);
      expect(banner).toHaveTextContent(/2, 3, 4, 5, 6 and 9 more/i);
    });

    it("reports a failure and unlocks when the file cannot be read", async () => {
      const user = setupUser();
      importPatterns.mockRejectedValue(new Error("NotReadableError"));

      const { onImported } = renderToolbar(
        patternsOf({ id: 1, label: "PAT1", multipliers: [1] }),
      );
      await clickImport(user);

      await waitFor(() =>
        expect(screen.getByText(/failed to read file/i)).toBeVisible(),
      );
      expect(onImported.mock.calls[0][0]).toBeNull();

      await user.click(screen.getByRole("button", { name: /dismiss/i }));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /^import$/i })).toBeEnabled(),
      );
    });

    it("does nothing when the file picker is cancelled", async () => {
      const user = setupUser();
      importPatterns.mockResolvedValue(null);

      const { onImported } = renderToolbar(
        patternsOf({ id: 1, label: "PAT1", multipliers: [1] }),
      );
      await clickImport(user);

      await waitFor(() => expect(importPatterns).toHaveBeenCalled());
      expect(onImported).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: /^import$/i })).toBeVisible();
    });

    it("keeps the toolbar available and drops the report on dismiss", async () => {
      const user = setupUser();
      importing([{ label: "PAT1", type: "demand", multipliers: [7] }]);

      renderToolbar(
        patternsOf({ id: 1, label: "PAT1", type: "demand", multipliers: [1] }),
      );
      await clickImport(user);
      const summary = await screen.findByText(/added|updated|identical/i);

      expect(screen.getByRole("button", { name: /^import$/i })).toBeVisible();

      await user.click(screen.getByRole("button", { name: /dismiss/i }));

      expect(summary).not.toBeInTheDocument();
    });
  });

  describe("when read only", () => {
    it("disables importing but still allows export", () => {
      renderToolbar(patternsOf({ id: 1, label: "PAT1", multipliers: [1] }), {
        readOnly: true,
      });

      expect(screen.getByRole("button", { name: /^import$/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /export/i })).toBeEnabled();
    });
  });

  it("disables both actions while an import is in flight", async () => {
    const user = setupUser();
    let finishImport!: (result: unknown) => void;
    importPatterns.mockReturnValue(
      new Promise((resolve) => {
        finishImport = resolve;
      }),
    );

    renderToolbar(patternsOf({ id: 1, label: "PAT1", multipliers: [1] }));
    await clickImport(user);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^import$/i })).toBeDisabled(),
    );
    expect(screen.getByRole("button", { name: /export/i })).toBeDisabled();

    finishImport({
      status: "success",
      format: "csv",
      patterns: [{ label: "PAT1", type: "demand", multipliers: [9] }],
      errors: [],
    });

    await waitFor(() =>
      expect(screen.getByText(/added|updated|identical/i)).toBeVisible(),
    );
  });
});
