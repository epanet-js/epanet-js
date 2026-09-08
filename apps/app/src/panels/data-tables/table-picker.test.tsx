/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import "src/__helpers__/locale";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { CommandContainer } from "src/commands/__helpers__/command-container";
import { Store } from "src/state";
import { activatePanelAtom, activePanelIn, panelsAtom } from "src/state/panels";
import { createAssetTablePanel, createTablePickerPanel } from "./create-panel";
import { TablePicker } from "./table-picker";

const aStore = () =>
  setInitialState({
    hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
  });

const renderPicker = (store: Store) =>
  render(
    <CommandContainer store={store}>
      <TablePicker id="table-picker" />
    </CommandContainer>,
  );

const openButton = () => screen.getByRole("button", { name: "Open" });

beforeEach(() => {
  stubUserTracking();
});

describe("TablePicker", () => {
  it("disables Open until something is checked", async () => {
    const store = aStore();
    store.set(panelsAtom, [createTablePickerPanel()]);

    renderPicker(store);
    expect(openButton()).toBeDisabled();

    await userEvent.click(screen.getByRole("checkbox", { name: /Junctions/ }));

    expect(openButton()).toBeEnabled();
  });

  it("opens a table for each checked type", async () => {
    const store = aStore();
    store.set(panelsAtom, [createTablePickerPanel()]);

    renderPicker(store);
    await userEvent.click(screen.getByRole("checkbox", { name: /Junctions/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Pipes/ }));
    await userEvent.click(openButton());

    expect(store.get(panelsAtom).map((panel) => panel.type)).toEqual([
      "asset-table",
      "asset-table",
    ]);
  });

  it("shows an already-open table as checked and disabled", () => {
    const store = aStore();
    store.set(panelsAtom, [
      createTablePickerPanel(),
      createAssetTablePanel("pipe", { id: "pipe", closable: false }),
    ]);

    renderPicker(store);

    const pipes = screen.getByRole("checkbox", { name: /Pipes/ });
    expect(pipes).toBeChecked();
    expect(pipes).toBeDisabled();
  });

  it("keeps Open disabled when only already-open tables are listed", () => {
    const store = aStore();
    store.set(panelsAtom, [
      createTablePickerPanel(),
      createAssetTablePanel("pipe", { id: "pipe", closable: false }),
    ]);

    renderPicker(store);

    expect(openButton()).toBeDisabled();
  });

  it("opens only the newly checked table", async () => {
    const store = aStore();
    store.set(panelsAtom, [
      createTablePickerPanel(),
      createAssetTablePanel("pipe", { id: "pipe", closable: false }),
    ]);

    renderPicker(store);
    await userEvent.click(screen.getByRole("checkbox", { name: /Valves/ }));
    await userEvent.click(openButton());

    expect(
      store
        .get(panelsAtom)
        .map((panel) => ("assetType" in panel ? panel.assetType : panel.type)),
    ).toEqual(["pipe", "valve"]);
  });

  it("closes itself once the tables are open", async () => {
    const store = aStore();
    store.set(panelsAtom, [createTablePickerPanel()]);

    renderPicker(store);
    await userEvent.click(screen.getByRole("checkbox", { name: /Junctions/ }));
    await userEvent.click(openButton());

    expect(
      store.get(panelsAtom).some((panel) => panel.type === "table-picker"),
    ).toBe(false);
  });

  it("leaves the newly opened table active, not a neighbour", async () => {
    const store = aStore();
    store.set(panelsAtom, [
      createAssetTablePanel("pipe", { id: "pipe", closable: false }),
      createTablePickerPanel(),
    ]);
    store.set(activatePanelAtom, "table-picker");

    renderPicker(store);
    await userEvent.click(screen.getByRole("checkbox", { name: /Valves/ }));
    await userEvent.click(openButton());

    expect(store.get(activePanelIn("bottom"))?.panel).toMatchObject({
      assetType: "valve",
    });
  });

  it("offers the selected-assets scope as not yet available", () => {
    const store = aStore();
    store.set(panelsAtom, [createTablePickerPanel()]);

    renderPicker(store);

    expect(
      screen.getByRole("checkbox", { name: /Selected assets only/ }),
    ).toBeDisabled();
  });
});
