import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { createAssetTablePanel } from "src/panels/data-tables/create-panel";
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
      assetTypes: ["junction", "pipe"],
      includeCustomerPoints: false,
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
      assetTypes: ["junction", "pipe"],
      includeCustomerPoints: false,
    });

    const ids = store.get(panelsAtom).map((panel) => panel.id);
    expect(new Set(ids).size).toEqual(2);
  });

  it("activates the first requested table", async () => {
    const store = aStore();
    store.set(panelsAtom, []);

    await open(store, {
      assetTypes: ["pipe", "valve"],
      includeCustomerPoints: false,
    });

    expect(store.get(activePanelIn("bottom"))?.panel).toMatchObject({
      type: "asset-table",
      assetType: "pipe",
    });
  });

  it("does not open a second table for an asset type already open", async () => {
    const store = aStore();
    store.set(panelsAtom, [
      createAssetTablePanel("pipe", { id: "pipe", closable: false }),
    ]);

    await open(store, { assetTypes: ["pipe"], includeCustomerPoints: false });

    expect(tablesOf(store)).toEqual(["asset-table:pipe"]);
  });

  it("activates the existing table instead of duplicating it", async () => {
    const store = aStore();
    store.set(panelsAtom, [
      createAssetTablePanel("junction", { id: "junction", closable: false }),
      createAssetTablePanel("pipe", { id: "pipe", closable: false }),
    ]);

    await open(store, { assetTypes: ["pipe"], includeCustomerPoints: false });

    expect(store.get(activePanelIn("bottom"))?.id).toEqual("pipe");
  });

  it("opens only the types that are not already open", async () => {
    const store = aStore();
    store.set(panelsAtom, [
      createAssetTablePanel("pipe", { id: "pipe", closable: false }),
    ]);

    await open(store, {
      assetTypes: ["pipe", "valve"],
      includeCustomerPoints: false,
    });

    expect(tablesOf(store)).toEqual(["asset-table:pipe", "asset-table:valve"]);
  });

  it("opens the customer points table when asked", async () => {
    const store = aStore();
    store.set(panelsAtom, []);

    await open(store, { assetTypes: [], includeCustomerPoints: true });

    expect(tablesOf(store)).toEqual(["customer-point-table:"]);
  });

  it("does nothing when nothing is requested", async () => {
    const store = aStore();
    store.set(panelsAtom, []);

    await open(store, { assetTypes: [], includeCustomerPoints: false });

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
