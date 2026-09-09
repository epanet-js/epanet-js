/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import "src/__helpers__/locale";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { CommandContainer } from "src/commands/__helpers__/command-container";
import { USelection } from "src/selection";
import { Store } from "src/state";
import { activePanelIn, panelsAtom } from "src/state/panels";
import { createAssetTablePanel } from "src/panels/data-tables/create-panel";
import { OpenDataTablesDialog } from "./open-data-tables";

const aStore = () =>
  setInitialState({
    hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
  });

const onClose = vi.fn();

const renderPicker = (store: Store) =>
  render(
    <CommandContainer store={store}>
      <OpenDataTablesDialog onClose={onClose} />
    </CommandContainer>,
  );

const aStoreWithSelection = (assetIds: number[]) =>
  setInitialState({
    hydraulicModel: HydraulicModelBuilder.with()
      .aJunction(1)
      .aJunction(2)
      .aPipe(10, { startNodeId: 1, endNodeId: 2 })
      .build(),
    selection: USelection.fromAssetIds(assetIds),
  });

const anEmptyModelStore = () =>
  setInitialState({ hydraulicModel: HydraulicModelBuilder.with().build() });

const openButton = () => screen.getByRole("button", { name: "Open" });

const scopeCheckbox = () =>
  screen.getByRole("checkbox", { name: /Selected assets only/ });

beforeEach(() => {
  stubUserTracking();
  onClose.mockClear();
});

describe("OpenDataTablesDialog", () => {
  it("disables Open until something is checked", async () => {
    const store = anEmptyModelStore();
    store.set(panelsAtom, []);

    renderPicker(store);
    expect(openButton()).toBeDisabled();

    await userEvent.click(screen.getByRole("option", { name: /Junctions/ }));

    expect(openButton()).toBeEnabled();
  });

  it("opens a table for each checked type", async () => {
    const store = anEmptyModelStore();
    store.set(panelsAtom, []);

    renderPicker(store);
    await userEvent.click(screen.getByRole("option", { name: /Junctions/ }));
    await userEvent.click(screen.getByRole("option", { name: /Pipes/ }));
    await userEvent.click(openButton());

    expect(store.get(panelsAtom).map((panel) => panel.type)).toEqual([
      "asset-table",
      "asset-table",
    ]);
  });

  it("pre-selects nothing once a data table is open", () => {
    const store = aStore();
    store.set(panelsAtom, [
      createAssetTablePanel("pipe", { id: "pipe", closable: false }),
    ]);

    renderPicker(store);

    expect(screen.getByRole("option", { name: /Pipes/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("lets a ticked table be unticked", async () => {
    const store = aStore();
    store.set(panelsAtom, []);

    renderPicker(store);
    const junctions = () => screen.getByRole("option", { name: /Junctions/ });
    expect(junctions()).toHaveAttribute("aria-selected", "true");
    await userEvent.click(junctions());

    expect(junctions()).toHaveAttribute("aria-selected", "false");
    expect(openButton()).toBeDisabled();
  });

  it("keeps the ticks when the selection scope is toggled", async () => {
    const store = aStoreWithSelection([1]);
    store.set(panelsAtom, []);

    renderPicker(store);
    await userEvent.click(screen.getByRole("option", { name: /Junctions/ }));
    await userEvent.click(scopeCheckbox());

    expect(screen.getByRole("option", { name: /Junctions/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByRole("option", { name: /Pipes/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("pre-selects every type the model has onto an empty dock", () => {
    const store = aStoreWithSelection([]);
    store.set(panelsAtom, []);

    renderPicker(store);

    expect(screen.getByRole("option", { name: /Junctions/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("option", { name: /Pipes/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("leaves a type the model has none of unticked", () => {
    const store = aStoreWithSelection([]);
    store.set(panelsAtom, []);

    renderPicker(store);

    expect(screen.getByRole("option", { name: /Valves/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("counts every asset of the type while the scope is the whole model", () => {
    const store = aStoreWithSelection([1]);
    store.set(panelsAtom, []);

    renderPicker(store);

    expect(
      screen.getByRole("option", { name: /Junctions \(2\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Pipes \(1\)/ }),
    ).toBeInTheDocument();
  });

  it("keeps Open disabled until a table is ticked", () => {
    const store = aStore();
    store.set(panelsAtom, [
      createAssetTablePanel("pipe", { id: "pipe", closable: false }),
    ]);

    renderPicker(store);

    expect(openButton()).toBeDisabled();
  });

  it("opens only the newly checked table", async () => {
    const store = aStore();
    store.set(panelsAtom, [
      createAssetTablePanel("pipe", { id: "pipe", closable: false }),
    ]);

    renderPicker(store);
    await userEvent.click(screen.getByRole("option", { name: /Valves/ }));
    await userEvent.click(openButton());

    expect(
      store
        .get(panelsAtom)
        .map((panel) => ("assetType" in panel ? panel.assetType : panel.type)),
    ).toEqual(["pipe", "valve"]);
  });

  it("closes once the tables are open", async () => {
    const store = aStore();
    store.set(panelsAtom, []);

    renderPicker(store);
    await userEvent.click(openButton());

    expect(onClose).toHaveBeenCalled();
  });

  it("activates the table it just opened", async () => {
    const store = aStore();
    store.set(panelsAtom, [
      createAssetTablePanel("pipe", { id: "pipe", closable: false }),
    ]);

    renderPicker(store);
    await userEvent.click(screen.getByRole("option", { name: /Valves/ }));
    await userEvent.click(openButton());

    expect(store.get(activePanelIn("bottom"))?.panel).toMatchObject({
      assetType: "valve",
    });
  });

  it("offers the selected-assets scope once something is selected", () => {
    const store = aStoreWithSelection([1]);
    store.set(panelsAtom, []);

    renderPicker(store);

    expect(scopeCheckbox()).toBeEnabled();
  });

  it("opens the checked tables scoped to the selection", async () => {
    const store = aStoreWithSelection([1, 2]);
    store.set(panelsAtom, []);

    renderPicker(store);
    await userEvent.click(scopeCheckbox());
    await userEvent.click(screen.getByRole("option", { name: /Pipes/ }));
    await userEvent.click(openButton());

    expect(store.get(panelsAtom)).toMatchObject([
      { assetType: "junction", assetIds: [1, 2] },
    ]);
  });

  it("lets a scoped table be opened for a type already open", async () => {
    const store = aStoreWithSelection([1]);
    store.set(panelsAtom, [
      createAssetTablePanel("junction", { id: "junction", closable: false }),
    ]);

    renderPicker(store);
    await userEvent.click(scopeCheckbox());

    expect(
      screen.getByRole("option", { name: /Junctions/ }),
    ).toBeInTheDocument();
  });

  it("shows a zero count for a type the selection has none of", async () => {
    const store = aStoreWithSelection([1]);
    store.set(panelsAtom, []);

    renderPicker(store);
    await userEvent.click(scopeCheckbox());

    expect(
      screen.getByRole("option", { name: /Pipes \(0\)/ }),
    ).toBeInTheDocument();
  });

  it("shows how many of each type are selected", async () => {
    const store = aStoreWithSelection([1, 2]);
    store.set(panelsAtom, []);

    renderPicker(store);
    await userEvent.click(scopeCheckbox());

    expect(
      screen.getByRole("option", { name: /Junctions \(2\)/ }),
    ).toBeInTheDocument();
  });

  it("offers no selected-assets scope while nothing is selected", () => {
    const store = aStore();
    store.set(panelsAtom, []);

    renderPicker(store);

    expect(
      screen.getByRole("checkbox", { name: /Selected assets only/ }),
    ).toBeDisabled();
  });
});
