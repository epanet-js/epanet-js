import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { createAssetTablePanel } from "src/panels/data-tables/create-panel";
import { USelection } from "src/selection";
import { Store } from "src/state";
import { activePanelIn, panelsAtom } from "src/state/panels";
import { CommandContainer } from "./__helpers__/command-container";
import {
  type OpenDataTablesRequest,
  useOpenDataTables,
} from "./open-data-tables";

const aStore = () =>
  setInitialState({
    hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
  });

const aModelWithSelection = (assetIds: number[]) =>
  setInitialState({
    hydraulicModel: HydraulicModelBuilder.with()
      .aJunction(1)
      .aJunction(2)
      .aPipe(10, { startNodeId: 1, endNodeId: 2 })
      .build(),
    selection: USelection.fromAssetIds(assetIds),
  });

const tablesOf = (store: Store) =>
  store
    .get(panelsAtom)
    .map(
      (panel) => `${panel.type}:${"assetType" in panel ? panel.assetType : ""}`,
    );

beforeEach(() => {
  stubUserTracking();
});

describe("useOpenDataTables", () => {
  it("opens a table per requested asset type", async () => {
    const store = aStore();
    store.set(panelsAtom, []);

    await open(store, {
      tableTypes: ["junction", "pipe"],
    });

    expect(tablesOf(store)).toEqual([
      "asset-table:junction",
      "asset-table:pipe",
    ]);
  });

  it("gives each opened table its own id", async () => {
    const store = aStore();
    store.set(panelsAtom, []);

    await open(store, {
      tableTypes: ["junction", "pipe"],
    });

    const ids = store.get(panelsAtom).map((panel) => panel.id);
    expect(new Set(ids).size).toEqual(2);
  });

  it("activates the first requested table", async () => {
    const store = aStore();
    store.set(panelsAtom, []);

    await open(store, {
      tableTypes: ["pipe", "valve"],
    });

    expect(store.get(activePanelIn("bottom"))?.panel).toMatchObject({
      type: "asset-table",
      assetType: "pipe",
    });
  });

  it("opens what it is asked for, even when that type is already open", async () => {
    const store = aStore();
    store.set(panelsAtom, [
      createAssetTablePanel("pipe", { id: "pipe", closable: false }),
    ]);

    await open(store, { tableTypes: ["pipe"] });

    expect(tablesOf(store)).toEqual(["asset-table:pipe", "asset-table:pipe"]);
  });

  it("activates the table it just opened, not the existing one", async () => {
    const store = aStore();
    store.set(panelsAtom, [
      createAssetTablePanel("pipe", { id: "pipe", closable: false }),
    ]);

    await open(store, { tableTypes: ["pipe"] });

    expect(store.get(activePanelIn("bottom"))?.id).not.toEqual("pipe");
  });

  it("opens the customer points table when asked", async () => {
    const store = aStore();
    store.set(panelsAtom, []);

    await open(store, { tableTypes: ["customerPoints"] });

    expect(tablesOf(store)).toEqual(["customer-point-table:"]);
  });

  it("scopes every opened table to the current selection", async () => {
    const store = aModelWithSelection([1, 2, 10]);
    store.set(panelsAtom, []);

    await open(store, {
      tableTypes: ["junction", "pipe"],
      scope: "selection",
    });

    expect(store.get(panelsAtom)).toMatchObject([
      { assetType: "junction", assetIds: [1, 2, 10] },
      { assetType: "pipe", assetIds: [1, 2, 10] },
    ]);
  });

  it("opens a table for a type the selection has none of", async () => {
    const store = aModelWithSelection([1, 2]);
    store.set(panelsAtom, []);

    await open(store, {
      tableTypes: ["junction", "pipe"],
      scope: "selection",
    });

    expect(tablesOf(store)).toEqual([
      "asset-table:junction",
      "asset-table:pipe",
    ]);
  });

  it("opens a scoped table alongside the whole-model one", async () => {
    const store = aModelWithSelection([1]);
    store.set(panelsAtom, [
      createAssetTablePanel("junction", { id: "junction", closable: false }),
    ]);

    await open(store, {
      tableTypes: ["junction"],
      scope: "selection",
    });

    const [wholeModel, scoped] = store.get(panelsAtom);
    expect(wholeModel).not.toHaveProperty("assetIds");
    expect(scoped).toMatchObject({ assetType: "junction", assetIds: [1] });
  });

  it("activates the newly scoped table, not the existing one", async () => {
    const store = aModelWithSelection([1]);
    store.set(panelsAtom, [
      createAssetTablePanel("junction", { id: "junction", closable: false }),
    ]);

    await open(store, {
      tableTypes: ["junction"],
      scope: "selection",
    });

    expect(store.get(activePanelIn("bottom"))?.id).not.toEqual("junction");
  });

  it("hands the table the selection, not only its own type's ids", async () => {
    const store = aModelWithSelection([10]);
    store.set(panelsAtom, []);

    await open(store, {
      tableTypes: ["junction"],
      scope: "selection",
    });

    expect(store.get(panelsAtom)).toMatchObject([
      { assetType: "junction", assetIds: [10] },
    ]);
  });

  it("opens whole-model tables when the scope is not the selection", async () => {
    const store = aModelWithSelection([1]);
    store.set(panelsAtom, []);

    await open(store, {
      tableTypes: ["junction"],
    });

    expect(store.get(panelsAtom)[0]).not.toHaveProperty("assetIds");
  });

  it("does nothing when nothing is requested", async () => {
    const store = aStore();
    store.set(panelsAtom, []);

    await open(store, { tableTypes: [] });

    expect(store.get(panelsAtom)).toEqual([]);
  });
});

const Trigger = ({ request }: { request: OpenDataTablesRequest }) => {
  const openDataTables = useOpenDataTables();
  return (
    <button aria-label="open" onClick={() => openDataTables(request)}>
      Open
    </button>
  );
};

const open = async (store: Store, request: OpenDataTablesRequest) => {
  render(
    <CommandContainer store={store}>
      <Trigger request={request} />
    </CommandContainer>,
  );
  await userEvent.click(screen.getByRole("button", { name: "open" }));
};
