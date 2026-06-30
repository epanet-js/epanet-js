import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { Provider as JotaiProvider } from "jotai";
import {
  emptyCustomAttributesDefinition,
  setAttributes,
} from "@epanet-js/custom-attributes";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { stubFeatureOn } from "src/__helpers__/feature-flags";
import { Persistence } from "src/lib/persistence/persistence";
import { PersistenceContext } from "src/lib/persistence/context";
import { customAttributesDefinitionAtom } from "src/state/custom-attributes";
import { Store } from "src/state";
import { CustomAttributesDialog } from "./custom-attributes-dialog";

const renderDialog = (store: Store) => {
  const persistence = new Persistence(store);
  return render(
    <PersistenceContext.Provider value={persistence}>
      <JotaiProvider store={store}>
        <CustomAttributesDialog />
      </JotaiProvider>
    </PersistenceContext.Provider>,
  );
};

const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 });

const withSavedAttribute = (store: Store) =>
  store.set(
    customAttributesDefinitionAtom,
    setAttributes(emptyCustomAttributesDefinition(), "pipe", [
      { id: "ca-1", label: "Age", type: "number" },
    ]),
  );

describe("CustomAttributesDialog type locking", () => {
  beforeEach(() => {
    stubUserTracking();
    stubFeatureOn("FLAG_CUSTOM_ATTRIBUTES");
  });

  it("blocks the type selector for an already-saved attribute", () => {
    const store = setInitialState();
    withSavedAttribute(store);

    renderDialog(store);

    const typeCell = screen.getAllByRole("gridcell")[1];
    expect(within(typeCell).getByText("Number")).toBeInTheDocument();
    expect(within(typeCell).queryByRole("button")).not.toBeInTheDocument();
  });

  it("allows changing the type for a newly added attribute", async () => {
    const user = setupUser();
    const store = setInitialState();
    withSavedAttribute(store);

    renderDialog(store);

    await user.click(screen.getByRole("button", { name: /add attribute/i }));

    const typeButton = await waitFor(() => {
      const button = screen
        .getAllByRole("button")
        .find((candidate) => candidate.textContent?.trim() === "Text");
      expect(button).toBeDefined();
      return button!;
    });

    await user.click(typeButton);

    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    const numberOption = within(screen.getByRole("listbox")).getByText(
      "Number",
    );
    await user.click(numberOption);

    await waitFor(() => {
      expect(
        screen
          .getAllByRole("button")
          .some((candidate) => candidate.textContent?.trim() === "Number"),
      ).toBe(true);
    });
  });
});
