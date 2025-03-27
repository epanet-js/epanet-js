import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "react-query";
import { UIDMap } from "src/lib/id_mapper";
import { Store, layerConfigAtom } from "src/state/jotai";
import { Provider as JotaiProvider } from "jotai";
import { PersistenceContext } from "src/lib/persistence/context";
import { Dialogs } from "../dialogs";
import Notifications from "../notifications";
import { MemPersistence } from "src/lib/persistence/memory";
import { aLayerConfig, setInitialState } from "src/__helpers__/state";
import { LayersPopover } from "./popover";
import { LayerConfigMap } from "src/types";
import userEvent from "@testing-library/user-event";

describe("layers popover", () => {
  it("shows selected basemap", () => {
    const basemap = aLayerConfig({
      type: "MAPBOX",
      isBasemap: true,
      name: "Streets",
    });
    const layerConfigs: LayerConfigMap = new Map();
    layerConfigs.set(basemap.id, basemap);

    const store = setInitialState({ layerConfigs });
    renderComponent({ store });

    expect(screen.getByText(/BASEMAP/)).toBeInTheDocument();
    expect(screen.getByText(/Streets/)).toBeInTheDocument();
  });

  it("can change basemap from the dropdown", async () => {
    const basemap = aLayerConfig({
      type: "MAPBOX",
      isBasemap: true,
      name: "Streets",
    });
    const layerConfigs: LayerConfigMap = new Map();
    layerConfigs.set(basemap.id, basemap);

    const store = setInitialState({ layerConfigs });
    renderComponent({ store });

    await userEvent.click(screen.getByRole("combobox", { name: /basemaps/i }));
    await userEvent.click(screen.getByText("Monochrome"));

    expect(screen.getByText(/BASEMAP/)).toBeInTheDocument();
    expect(screen.getByText(/Monochrome/)).toBeInTheDocument();
    const updatedLayerConfigs = store.get(layerConfigAtom);
    expect(hasLayer(updatedLayerConfigs, "Monochrome"));
  });

  const hasLayer = (layerConfigs: LayerConfigMap, name: string) => {
    return [...layerConfigs.values()].find((l) => l.name === name);
  };

  const renderComponent = ({ store }: { store: Store }) => {
    render(
      <Container store={store}>
        <LayersPopover />
      </Container>,
    );
  };

  const Container = ({
    store,
    children,
  }: {
    store: Store;
    children: React.ReactNode;
  }) => {
    const idMap = UIDMap.empty();
    return (
      <QueryClientProvider client={new QueryClient()}>
        <JotaiProvider store={store}>
          <PersistenceContext.Provider value={new MemPersistence(idMap, store)}>
            <Dialogs></Dialogs>
            <Notifications duration={1} successDuration={1} />
            {children}
          </PersistenceContext.Provider>
        </JotaiProvider>
      </QueryClientProvider>
    );
  };
});
