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

const curvesOf = (...items: ICurve[]): Curves =>
  new Map(items.map((c) => [c.id, c]));

const renderToolbar = (
  curves: Curves,
  scope: CurveType[] = ["volume", "valve", "headloss"],
) => {
  const store: Store = setInitialState({});

  render(
    <JotaiProvider store={store}>
      <ImportExportCurvesToolbar
        curves={curves}
        scope={scope}
        fileSuffix="curves"
      />
    </JotaiProvider>,
  );
};

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

  it("offers no import while only exporting is supported", () => {
    renderToolbar(curvesOf({ id: 1, label: "C1", points: [{ x: 0, y: 1 }] }));

    expect(screen.getByRole("button", { name: /export/i })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /^import$/i }),
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
});
