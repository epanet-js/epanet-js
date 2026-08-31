import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider } from "jotai";
import { vi } from "vitest";
import type { CurveType, Curves, ICurve } from "@epanet-js/hydraulic-model";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { stubFeatureOn, stubFeatureOff } from "src/__helpers__/feature-flags";
import type { Store } from "src/state";
import { ImportExportCurvesToolbar } from "./import-export-curves-toolbar";

const exportToCsv = vi.fn();
const exportToXlsx = vi.fn();

vi.mock("src/commands/export-curves", () => ({
  useExportCurves: () => ({ exportToCsv, exportToXlsx }),
}));

const importCurves = vi.fn();

vi.mock("src/commands/import-curves", () => ({
  useImportCurves: () => importCurves,
}));

const curvesOf = (...items: ICurve[]): Curves =>
  new Map(items.map((c) => [c.id, c]));

const renderToolbar = (
  curves: Curves,
  scope: CurveType[] = ["volume", "valve", "headloss"],
) => {
  const store: Store = setInitialState({});
  const onImported = vi.fn<(curves: Curves) => void>();

  render(
    <JotaiProvider store={store}>
      <ImportExportCurvesToolbar
        curves={curves}
        scope={scope}
        fileSuffix="curves"
        onImported={onImported}
      />
    </JotaiProvider>,
  );

  return { onImported };
};

const clickImport = (user: ReturnType<typeof setupUser>) =>
  user.click(screen.getByRole("button", { name: /^import$/i }));

const setupUser = () => userEvent.setup();

describe("ImportExportCurvesToolbar", () => {
  beforeEach(() => {
    stubUserTracking();
    stubFeatureOn("FLAG_CURVES_IMPORT_EXPORT");
    vi.clearAllMocks();
  });

  it("renders nothing when the flag is off", () => {
    stubFeatureOff("FLAG_CURVES_IMPORT_EXPORT");

    renderToolbar(curvesOf({ id: 1, label: "C1", points: [{ x: 0, y: 1 }] }));

    expect(
      screen.queryByRole("button", { name: /export/i }),
    ).not.toBeInTheDocument();
  });

  it("exports the curves it was given as CSV", async () => {
    const user = setupUser();
    const curves = curvesOf({
      id: 1,
      label: "C1",
      type: "volume",
      points: [{ x: 0, y: 1 }],
    });

    renderToolbar(curves);
    await user.click(screen.getByRole("button", { name: /export/i }));
    await user.click(screen.getByRole("menuitem", { name: /\.csv/i }));

    await waitFor(() => expect(exportToCsv).toHaveBeenCalled());
    expect(exportToCsv.mock.calls[0][0]).toBe(curves);
  });

  it("exports as XLSX", async () => {
    const user = setupUser();

    renderToolbar(curvesOf({ id: 1, label: "C1", points: [{ x: 0, y: 1 }] }));
    await user.click(screen.getByRole("button", { name: /export/i }));
    await user.click(screen.getByRole("menuitem", { name: /\.xlsx/i }));

    await waitFor(() => expect(exportToXlsx).toHaveBeenCalled());
  });

  it("passes its own scope through to the exporter", async () => {
    const user = setupUser();

    renderToolbar(curvesOf({ id: 1, label: "C1", points: [{ x: 0, y: 1 }] }), [
      "pump",
      "efficiency",
    ]);
    await user.click(screen.getByRole("button", { name: /export/i }));
    await user.click(screen.getByRole("menuitem", { name: /\.csv/i }));

    await waitFor(() => expect(exportToCsv).toHaveBeenCalled());
    expect(exportToCsv.mock.calls[0][1].scope).toEqual(["pump", "efficiency"]);
  });

  describe("importing", () => {
    const importing = (
      curves: { label: string; type?: string; points: unknown[] }[],
      overrides: Record<string, unknown> = {},
    ) =>
      importCurves.mockResolvedValue({
        status: "success",
        format: "csv",
        curves,
        ignored: 0,
        errors: [],
        ...overrides,
      });

    it("appends a curve that is not already in the draft", async () => {
      const user = setupUser();
      importing([{ label: "NEW", type: "volume", points: [{ x: 0, y: 1 }] }]);

      const { onImported } = renderToolbar(
        curvesOf({
          id: 1,
          label: "C1",
          type: "volume",
          points: [{ x: 0, y: 1 }],
        }),
      );
      await clickImport(user);

      await waitFor(() => expect(onImported).toHaveBeenCalled());
      const merged = onImported.mock.calls[0][0];
      expect([...merged.values()].map((c) => c.label)).toEqual(["C1", "NEW"]);
    });

    it("replaces a matching curve in place, keeping its id", async () => {
      const user = setupUser();
      importing([{ label: "C1", type: "volume", points: [{ x: 2, y: 3 }] }]);

      const { onImported } = renderToolbar(
        curvesOf({
          id: 7,
          label: "C1",
          type: "volume",
          points: [{ x: 0, y: 1 }],
        }),
      );
      await clickImport(user);

      await waitFor(() => expect(onImported).toHaveBeenCalled());
      expect(onImported.mock.calls[0][0].get(7)?.points).toEqual([
        { x: 2, y: 3 },
      ]);
    });

    it("reports the result and what it left alone", async () => {
      const user = setupUser();
      importing([{ label: "NEW", type: "volume", points: [{ x: 0, y: 1 }] }]);

      renderToolbar(
        curvesOf({
          id: 1,
          label: "C1",
          type: "volume",
          points: [{ x: 0, y: 1 }],
        }),
      );
      await clickImport(user);

      expect(
        await screen.findByText("Curves imported: 1 added, 1 not in the file"),
      ).toBeVisible();
    });

    it("collapses the issues behind a summary", async () => {
      const user = setupUser();
      importing([{ label: "C1", type: "volume", points: [{ x: 0, y: 1 }] }], {
        status: "partial",
        ignored: 1,
        errors: [{ message: "curves.import.unpairedAxis", row: 4 }],
      });

      renderToolbar(
        curvesOf({
          id: 1,
          label: "C1",
          type: "volume",
          points: [{ x: 9, y: 9 }],
        }),
      );
      await clickImport(user);

      const summary = await screen.findByText(/^issues$/i);
      const reason = screen.getByText(/no matching x and y rows/i);
      expect(reason).not.toBeVisible();

      await user.click(summary);
      expect(reason).toBeVisible();
    });

    it("does nothing when the file picker is cancelled", async () => {
      const user = setupUser();
      importCurves.mockResolvedValue(null);

      const { onImported } = renderToolbar(
        curvesOf({ id: 1, label: "C1", points: [{ x: 0, y: 1 }] }),
      );
      await clickImport(user);

      await waitFor(() => expect(importCurves).toHaveBeenCalled());
      expect(onImported).not.toHaveBeenCalled();
    });
  });
});
