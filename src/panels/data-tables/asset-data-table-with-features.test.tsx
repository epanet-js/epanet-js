/**
 * @vitest-environment jsdom
 */
import "src/__helpers__/user-tracking";
import "src/__helpers__/locale";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@radix-ui/react-tooltip";

import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { PersistenceContext } from "src/lib/persistence/context";
import { Persistence } from "src/lib/persistence/persistence";
import type { Store } from "src/state";

import { AssetDataTableWithFeatures } from "./asset-data-table-with-features";

vi.mock("src/components/notifications", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("src/components/notifications")>();
  return {
    ...original,
    notify: vi.fn(),
  };
});

import { notify } from "src/components/notifications";

const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 });

const renderTable = (store: Store) => {
  const persistence = new Persistence(store);
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <JotaiProvider store={store}>
        <PersistenceContext.Provider value={persistence}>
          <TooltipProvider>
            <AssetDataTableWithFeatures assetType="junction" />
          </TooltipProvider>
        </PersistenceContext.Provider>
      </JotaiProvider>
    </QueryClientProvider>,
  );
};

describe("AssetDataTableWithFeatures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubUserTracking();
    // jsdom has no navigator.clipboard; stub it so the copy path doesn't
    // throw before reaching the notify call.
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn(() => Promise.resolve()),
        readText: vi.fn(() => Promise.resolve("")),
      },
      configurable: true,
      writable: true,
    });
  });

  it("prompts to include headers when copying all rows of a column", async () => {
    const user = setupUser();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1" })
      .aJunction(2, { label: "J2" })
      .build();
    const store = setInitialState({ hydraulicModel });

    renderTable(store);

    // Wait for the rows to be built (computeRows uses setTimeout(0)).
    await waitFor(() => {
      expect(screen.getByDisplayValue("J1")).toBeInTheDocument();
    });

    // Click the first non-gutter column header → selects the entire column
    // (all rows). Header text comes from the translation layer which may
    // not be initialised under test, so target by role + index instead.
    const headers = screen.getAllByRole("columnheader");
    // headers[0] is the gutter "select all" cell; headers[1] is the first
    // data column (label).
    await user.click(headers[1]);

    // Trigger copy by dispatching a copy event on the grid container —
    // jsdom doesn't synthesise the clipboard event from Ctrl+C keydown.
    // The clipboard feature's handleCopyEvent → copySelection →
    // onClipboardCopy → AssetDataTable's handleCopy → notify.
    fireEvent.copy(screen.getByRole("grid"));

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/header/i),
          action: expect.objectContaining({ onClick: expect.any(Function) }),
        }),
      );
    });
  });

  it("does not prompt when only a subset of rows is selected", async () => {
    const user = setupUser();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1" })
      .aJunction(2, { label: "J2" })
      .build();
    const store = setInitialState({ hydraulicModel });

    renderTable(store);

    await waitFor(() => {
      expect(screen.getByDisplayValue("J1")).toBeInTheDocument();
    });

    // Click a single cell (first row, first editable column).
    await user.click(screen.getByDisplayValue("J1"));
    fireEvent.copy(screen.getByRole("grid"));

    // Give the async copy path a chance to complete.
    await new Promise((r) => setTimeout(r, 50));

    expect(notify).not.toHaveBeenCalled();
  });
});
